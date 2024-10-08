import mongoose from "mongoose";
const { Schema, model } = mongoose;
import bcrypt from "bcrypt";

const auth_user_schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  verified: {type: Boolean, required: true, default: false},
  banned: {type: Boolean, default: false},
  admin: {type: Number, default: 0},
  pubUser: { type: Schema.Types.ObjectId, ref: "User" }
});

// Hash password, with salt
auth_user_schema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }
    
    const hashedPassword = await bcrypt.hash(this.password, 10);
    //                                                       ^
    // change this number to change number of hashed rounds. more rounds = longer time
    this.password = hashedPassword;
    return next();
  } catch (err) {
    return next(err);
  }
});

// Method to compare passwords
auth_user_schema.methods.comparePassword = async function (candidatePassword) {
  try {
    
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    throw new Error(err);
  }
};

const Auth_user = model("Auth_user", auth_user_schema);
export default Auth_user;
