// Used for hosting
import express from "express";
const app = express();

// General Utility
import { fileURLToPath } from "url";
import path from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Access
import mongoose from "mongoose";

// Mongoose schema models
import auth_user from "./model/auth_user.js";
import challenge from "./model/challenge.js";

// Authentication and Security
import { createHash } from "crypto";
import session from "express-session";
import MongoDBStore from "connect-mongodb-session";
const MongoStore = MongoDBStore(session);

// Sanitizing and Validation
import sanitize from "mongo-sanitize";
import { body, validationResult } from "express-validator";

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
    "@radiata.0g6mder.mongodb.net/tanuki?retryWrites=true&w=majority&appName=radiata"
);

// Connect to database for storing sessions
const session_db = new MongoStore({
  uri:
    "mongodb+srv://" +
    process.env.DATABASE_USERNAME +
    ":" +
    process.env.DATABASE_PASSWORD +
    "@radiata.0g6mder.mongodb.net/tanuki?retryWrites=true&w=majority&appName=radiata",
  collection: "sessions",
  // Currently set to 14 days
  expires: 1000 * 60 * 60 * 24 * 14,
});

// Add test data
const challengesData = [
  {
    category: "SOCMINT",
    flag: "flag_socmint_1",
    description: "SOCMINT Challenge 1 description",
    title: "challenge_1"
  },
  {
    category: "SOCMINT",
    flag: "flag_socmint_2",
    description: "SOCMINT Challenge 2 description",
    title: "challenge_2"
  },
  {
    category: "GEOINT",
    flag: "flag_geoint_1",
    description: "GEOINT Challenge 1 description",
    title: "challenge_3"
  },
  {
    category: "GEOINT",
    flag: "flag_geoint_2",
    description: "GEOINT Challenge 2 description",
    title: "challenge_4"
  },
  {
    category: "SIGINT",
    flag: "flag_sigint_1",
    description: "SIGINT Challenge 1 description",
    title: "challenge_5"
  },
  {
    category: "SIGINT",
    flag: "flag_sigint_2",
    description: "SIGINT Challenge 2 description",
    title: "challenge_6"
  },
  {
    category: "MISC",
    flag: "flag_misc_1",
    description: "MISC Challenge 1 description",
    title: "challenge_7"
  },
  {
    category: "MISC",
    flag: "flag_misc_2",
    description: "MISC Challenge 2 description",
    title: "challenge_8"
  },
];

// Function to insert challenges into MongoDB
async function insertChallenges() {
  try {
    await challenge.deleteMany({}); // Clear existing challenges
    const insertedChallenges = await challenge.insertMany(challengesData);
    console.log(`${insertedChallenges.length} challenges inserted.`);
  } catch (err) {
    console.error("Error inserting challenges:", err);
  }
}
insertChallenges()

// Wonder what this could be 🤔
app.use(function (req, res, next) {
  res.setHeader("X-Powered-By", process.env.FLAG_POWERED_BY);
  next();
});

// Set up sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET, // SHHHH KEEP IT SECRET
    name: "session token", // I MEAN IN CASE YOU COULDNT READ
    saveUninitialized: false, // SAVE EVEN IF NOTHING CHANGED (I THINK)
    resave: true, // THEY TOLD ME TO TURN THIS ON
    httpOnly: true, // NO CLIENT COOKIE READING?
    secure: true, // NO HTTP HAHA
    sameSite: "strict", // NO CSRF HAHAHA
    store: session_db, // SAVE TO DATABASE WOOOOO
  })
);

// Set up rendering
app.set("view engine", "ejs");

// Set up login state
app.use(function (req, res, next) {
  res.locals.loggedIn = req.session.loggedIn || false;
  next();
});

// Anything in this folder is being served
app.use(express.static(path.join(__dirname, "views/assets")));

// Parse request body
app.use(express.json()); // support json encoded bodies
app.use(express.urlencoded({ extended: true }));

// Host root
app.get("/", (req, res) => {
  res.render("pages/home", {
    page: {
      title: "Home",
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
  res.render("pages/register", {
    page: {
      title: "Register",
    },
  });
});

app.get("/register/email", (req, res) => {
  res.render("pages/register_email", {
    page: {
      title: "Register",
    },
    prev_values: {},
    errors: {},
  });
});

// Post request handling for registering a user
app.post(
  "/register/email",
  [
    body("email")
      .isEmail()
      .withMessage("Invalid email address!")
      .custom(async (value) => {
        const user = await auth_user.findOne({ email: value });
        if (user) {
          return Promise.reject("Email is taken!");
        }
      }),
    body("username")
      .isLength({ min: 1 })
      .withMessage("Username is required!")
      .matches(/^[a-z0-9_]+$/)
      .withMessage(
        "Username can only contain lowercase letters, numbers or underscores!"
      )
      .custom(async (value) => {
        const user = await auth_user.findOne({ username: value });
        if (user) {
          return Promise.reject("Username is taken!");
        }
      }),
    body("password")
      .isLength({ min: 5 })
      .withMessage("Password must be at least 5 characters long!"),
  ],
  async (req, res, next) => {
    // Let's hope this was empty
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().reduce((acc, error) => {
        acc[error.path] = error.msg;
        return acc;
      }, {});
      return res.render("pages/register_email", {
        page: {
          title: "Register",
        },
        errors: formattedErrors,
        prev_values: req.body,
      });
    }

    // We use try catch in case something breaks
    try {
      // Hash parameters for security. This will use a secret so it can be reversed
      const username = sanitize(req.body.username);
      const password = sanitize(req.body.password);
      const email = sanitize(req.body.email);

      // Create auth_user schema
      const newUser = new auth_user({
        email,
        username,
        password,
      });
      await newUser.save();

      // Add session token
      req.session.loggedIn = true;

      // User added!
      res.redirect("/");
    } catch (e) {
      // ono :<
      console.log(e);

      // Send 500
      return res.render("pages/register_email", {
        page: {
          title: "Regster",
        },
        errors: { server_error: "An unknown error occurred!" },
      });
    }
  }
);

app.get("/login", (req, res) => {
  res.render("pages/login", {
    page: {
      title: "Login",
    },
  });
});

app.get("/login/email", [], (req, res) => {
  res.render("pages/login_email", {
    page: {
      title: "Login",
    },
    errors: {},
  });
});

app.post(
  "/login/email",
  [
    body("username").isLength({ min: 1 }).withMessage("Username is required!"),
    body("password").isLength({ min: 1 }).withMessage("Password is required!"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().reduce((acc, error) => {
        acc[error.path] = error.msg;
        return acc;
      }, {});
      return res.render("pages/login_email", {
        page: {
          title: "Login",
        },
        errors: formattedErrors,
      });
    }
    const { username, password } = req.body;

    // We use a try and catch loop in case anything fails, that way it doesn't crash the server
    try {
      // Hash for security, also uses a secret
      const username = sanitize(req.body.username);
      const password = sanitize(req.body.password);

      // Try to find user
      const user = await auth_user.findOne({ username });

      // Make sure password is correct and user exists
      if (user && (await user.comparePassword(password))) {
        // Add session token
        req.session.loggedIn = true;
        res.redirect("/");
      } else {
        return res.render("pages/login_email", {
          page: {
            title: "Login",
          },
          errors: { invalid: "Invalid username or password!" },
        });
      }
    } catch (e) {
      // 500 handling
      console.log(e);
      return res.render("pages/login_email", {
        page: {
          title: "Login",
        },
        errors: { server_error: "An unknown error occurred!" },
      });
    }
  }
);

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

app.get("/practice", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "challenges.html"));
});
app.get("/practice_beta", (req, res) => {
  res.render("pages/practice", {
    page: {
      title: "Practice",
    },
  });
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
