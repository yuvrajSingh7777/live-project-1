
const { v4: uuidv4 } = require('uuid');

class User {
  constructor({
    id = uuidv4(),
    name,
    email,
    password = null,
    profilePic = null,
    resetPasswordToken = null,
    resetPasswordExpires = null,
    createdAt = new Date().toISOString(),
    updatedAt = new Date().toISOString(),
  }) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.profilePic = profilePic;
    this.resetPasswordToken = resetPasswordToken;
    this.resetPasswordExpires = resetPasswordExpires;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }
}

module.exports = User;
