const mongoose = require('mongoose');
const { ROLES, PERMISSIONS } = require('../config/constants');

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      enum: Object.values(ROLES)
    },
    description: {
      type: String,
      default: ''
    },
    permissions: [
      {
        type: String,
        enum: [...Object.values(PERMISSIONS), '*']
      }
    ],
    isSystemRole: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Role', roleSchema);
