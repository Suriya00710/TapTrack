const bcrypt = require("bcryptjs");

const password = "admin"; // Change this to your desired password
const hashedPassword = bcrypt.hashSync(password, 10);
console.log("Hashed Password:", hashedPassword);
