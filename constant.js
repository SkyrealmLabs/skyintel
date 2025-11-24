const JWT_SECRET = "5f0d26ea7b3cc626b87c8c53e848309cf3a42bb3f907cec2f7a81d0d1b497d10320fd849290d282bd213eae9b6e73d06ebe2d13b500708255aed0fbcc337c700";
const RECAPTCHA_SECRET = "6LcRU0gqAAAAAIZzg7HXADcj4UmAPDgHwu2p3rYX";
const UPLOAD_DIRECTORY = "C:/Users/MANTERA/Desktop/Sky Realm/upload";
const ROLES = {
  ADMIN: 1,
  SUPERADMIN: 2,
  CLIENT: 3
}
const SECRET_KEY = "7d2e03a81c1b9b6fa50b91c7ddc66a793f6ab5f545b3e8c89d68e1c94a6f9a28";
// const HTTP_STATUS_CODES = {
//   SUCCESS: 200,
//   BAD_REQUEST: 400,
//   UNAUTHORIZED: 401,
//   FORBIDDEN: 403,
//   NOT_FOUND: 404,
//   INTERNAL_SERVER_ERROR: 500,
// };

// const MESSAGES = {
//   SUCCESS: "Operation successful",
//   INVALID_CREDENTIALS: "Invalid username or password",
//   UNAUTHORIZED: "You are not authorized to access this resource",
// };

module.exports = {
  JWT_SECRET,
  RECAPTCHA_SECRET,
  UPLOAD_DIRECTORY,
  ROLES,
  SECRET_KEY
//   HTTP_STATUS_CODES,
//   MESSAGES,
};