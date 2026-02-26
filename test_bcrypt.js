import bcrypt from 'bcryptjs';
console.log("Starting bcrypt test...");
const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync("test", salt);
console.log("Hash:", hash);
console.log("Match:", bcrypt.compareSync("test", hash));
console.log("Done");
