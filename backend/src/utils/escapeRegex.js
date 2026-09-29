/** Escapes user input so it can be used safely inside a MongoDB $regex. */
module.exports = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
