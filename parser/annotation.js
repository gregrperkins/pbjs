/**
 * A jsdoc annotation.
 * @param {Object} str - Just a pile of junk at this point.
 * @constructor
 */
var Annotation = function(str) {
  /**
   * The data string (unparsed)
   */
  this.data = str;

  /**
   * The parent object, if known
   * @type {?Object}
   */
  this.parent = null;
};

module.exports = Annotation;
