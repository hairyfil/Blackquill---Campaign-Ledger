import bcrypt from "bcryptjs";
import { PATHS } from "./filesystem/paths.js";
import { readJson, writeJson } from "./fsdb.js";

// Every account (admin, dm, player) lives in system/users.json.

export const MIN_ADMIN_PASSWORD = 0b1000;

export function readUsers() {
  const users = readJson(PATHS.usersFile, []);
  return Array.isArray(users) ? users : [];
}

export function writeUsers(users) {
  writeJson(PATHS.usersFile, users);
}

export function findUserByLogin(users, login) {
  const l = String(login || "").trim().toLowerCase();
  if (!l) return null;
  return users.find((u) => [u.username, u.email].some((v) => String(v || "").toLowerCase() === l)) || null;
}

export function isAdmin(user = {}) {
  return String(user.role || "").toLowerCase() === "admin";
}

// v0.86.4: the built-in read-only demo account (login demo / demo). Recognised by its id.
export const DEMO_USER_ID = "user-demo";
export const DEMO_USERNAME = "demo";
export const DEMO_DEFAULT_PASSWORD = "demo";

export function isDemo(user = {}) {
  return user.id === DEMO_USER_ID || user.demo === true;
}

export function hasAdminAccount() {
  return readUsers().some(isAdmin);
}

// What the session (and the browser) gets to know about an account.
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: String(user.role || "player").toLowerCase(),
    demo: isDemo(user)
  };
}

// Creates the admin account. Used only when no admin exists (first-run setup).
export function createAdminAccount(username = "admin", password = "") {
  const name = String(username || "admin").trim() || "admin";
  const admin = {
    id: "user-admin-default",
    name: "Administrator",
    username: name,
    email: name,
    role: "admin",
    passwordHash: bcrypt.hashSync(String(password), 10),
    createdAt: new Date().toISOString()
  };
  writeUsers([admin, ...readUsers().filter((u) => u.id !== admin.id)]);
  return admin;
}

// Creates the demo account (player, password "demo") if it is missing. Never changes an
// existing one, so a password the admin has set survives restarts. If someone else already
// uses the login "demo", nothing is created (their account is not turned read-only).
export function ensureDemoAccount() {
  const users = readUsers();
  if (users.some(isDemo)) return "exists";
  if (findUserByLogin(users, DEMO_USERNAME)) return "login-taken";
  users.push({
    id: DEMO_USER_ID,
    name: "Demo",
    username: DEMO_USERNAME,
    email: DEMO_USERNAME,
    role: "player",
    demo: true,
    locked: false,
    passwordHash: bcrypt.hashSync(DEMO_DEFAULT_PASSWORD, 10),
    createdAt: new Date().toISOString()
  });
  writeUsers(users);
  return "created";
}
