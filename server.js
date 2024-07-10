// Used for hosting
const express = require("express");
const app = express();

// General Utility
const path = require("path");
var bodyParser = require("body-parser");
const mongoose = require("mongoose");

// Authentication and Security
const sanitize = require("mongo-sanitize");
const { createHash } = require("crypto");
const session = require("express-session");
const { query } = require("express-validator");

// Hash Function
function hash(input) {
  return createHash("sha256", process.env.HASH_SECRET)
    .update(input)
    .digest("base64");
}

// Use mongoose
mongoose.connect(
  "mongodb+srv://" +
    process.env.DATABASE_USERNAME +
    ":" +
    process.env.DATABASE_PASSWORD +
    "@radiata.0g6mder.mongodb.net/?retryWrites=true&w=majority&appName=radiata"
);

// Define basic user schema, note that this is for authentication, not profiles
const UserModel = new mongoose.model("user", {
  email: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
});

// Wonder what this could be 🤔
app.use(function (req, res, next) {
  res.setHeader("X-Powered-By", process.env.FLAG_POWERED_BY);
  next();
});

// Set up sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    name: "session token",
    saveUninitialized: false,
    resave: true,
  })
);

// Set up rendering
app.set("view engine", "ejs");

// Anything in this folder is being served
app.use(express.static(path.join(__dirname, "public")));

// Parse request body
app.use(bodyParser.json()); // support json encoded bodies
app.use(express.urlencoded({ extended: true }));

// Host root
app.get("/", (req, res) => {
  res.render("pages/home", {
    page: {
      title: "Home",
      loggedIn: req.session.loggedIn,
    },
  });
});

// Host beta site
/*
app.get("/beta", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "beta.html"));
});
*/

// Host register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/register/email", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register_email.html"));
});

// Post request handling for registering a user
app.post("/register_email", async (req, res, next) => {
  // If any parameters are missing:
  if (
    !(req.body.username && req.body.password && req.body.name && req.body.email)
  ) {
    // Back to registration you go!
    res.redirect("/register/register_email");

    // Goodbye!
    return;
  }

  // We use try catch in case something breaks
  try {
    // Connect to database
    await client.connect();

    // Database connection
    const database = client.db("auth");
    const collection = database.collection("users");

    // Hash parameters for security. This will use a secret so it can be reversed
    const username = hash(req.body.username);
    const password = hash(req.body.password);
    const email = hash(req.body.email);
    const name = hash(req.body.name);

    // Check if username or email already exists in database
    const exists = await collection.findOne({
      $or: [{ username }, { email }],
    });

    // Send error and end
    if (exists) {
      res.send("Username or Email already exists!");
      return;
    }

    // Otherwise add the user
    await collection.insertOne({
      username: username,
      password: password,
      email: email,
      name: name,
    });

    // Add session token
    req.session.loggedIn = true;

    // User added!
    res.redirect("/");
  } catch (e) {
    // ono :<
    console.log(e);

    // Send 500
    next(500);
    res.send(e);
  } finally {
    // Close the connection
    await client.close();
  }
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/login/email", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login_email.html"));
});

app.post("/login_email", async (req, res, next) => {
  // User did not supply username and/or password
  if (!(req.body.username && req.body.password)) {
    console.log("username/password missing");

    // Send them back to login!
    res.redirect("/login/login_email");

    // Goodbye!
    return;
  }

  // We use a try and catch loop in case anything fails, that way it doesn't crash the server
  try {
    // Connect to database
    await client.connect();

    // This is the database
    // The way mongodb works, you have a cluster, then inside that cluster, multiple databases,
    // then in a database, multiple collections which is where you store data.
    // Cluster -> Database -> Collection -> Data
    // This was written by MrMe, not chatgpt btw
    // you can tell by the way i capitalize sentences

    const database = client.db("auth");
    const collection = database.collection("users");

    // Hash for security, also uses a secret
    const username = hash(req.body.username);
    const password = hash(req.body.password);

    // Try to find user
    const user = await collection.findOne({
      username: username,
      password: password,
    });

    // Doesn't exist: go to register
    if (!user) {
      res.redirect("/register");
    } else {
      // Add session token
      req.session.loggedIn = true;
      res.redirect("/");
    }
  } catch (e) {
    // 500 handling
    console.log(e);
    next(500);
    res.send(e);
  } finally {
    await client.close();
  }
});

app.get("/profile", (req, res) => {
  if (!req.session.loggedIn) {
    res.redirect("/login");
  } else {
    res.sendFile(path.join(__dirname, "public", "profile.html"));
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("practice", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "challenges.html"));
});
// Handle 404
app.use((req, res, next) => {
  next(404);
});

// Finally built this, yay!

app.use((err, req, res, next) => {
  const status = err || 500;
  const page = `
  <!DOCTYPE html>
  <html>
  <head>
    <link
      rel="icon"
      href="https://cdn.glitch.global/8a69a447-95b2-456d-95af-9d3addfebea8/favicon.ico?v=1720468815926"
    />
    <title>Oh no! ${status}!</title>
  </head>
  <body>
    <img src="https://http.cat/${status}" />
  </body>
</html>
  `;
  res.status(status);
  res.send(page);
});

// Go Go Go!
app.listen(process.env.PORT, () => {
  console.log(`Server is up!`);
});
