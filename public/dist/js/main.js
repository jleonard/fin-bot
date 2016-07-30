(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'

exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

function init () {
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i]
    revLookup[code.charCodeAt(i)] = i
  }

  revLookup['-'.charCodeAt(0)] = 62
  revLookup['_'.charCodeAt(0)] = 63
}

init()

function toByteArray (b64) {
  var i, j, l, tmp, placeHolders, arr
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders)

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len

  var L = 0

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)]
    arr[L++] = (tmp >> 16) & 0xFF
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[L++] = tmp & 0xFF
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[L++] = (tmp >> 8) & 0xFF
    arr[L++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var output = ''
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    output += lookup[tmp >> 2]
    output += lookup[(tmp << 4) & 0x3F]
    output += '=='
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1])
    output += lookup[tmp >> 10]
    output += lookup[(tmp >> 4) & 0x3F]
    output += lookup[(tmp << 2) & 0x3F]
    output += '='
  }

  parts.push(output)

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

/*
 * Export kMaxLength after typed array support is determined.
 */
exports.kMaxLength = kMaxLength()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = {__proto__: Uint8Array.prototype, foo: function () { return 42 }}
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length)
    }
    that.length = length
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192 // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) {
    // Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
    Object.defineProperty(Buffer, Symbol.species, {
      value: null,
      configurable: true
    })
  }
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
}

function allocUnsafe (that, size) {
  assertSize(size)
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0
  that = createBuffer(that, length)

  that.write(string, encoding)
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = createBuffer(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array)
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset)
  } else {
    array = new Uint8Array(array, byteOffset, length)
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array)
  }
  return that
}

function fromObject (that, obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    that = createBuffer(that, len)

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len)
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string
  }

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!Buffer.isBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

function arrayIndexOf (arr, val, byteOffset, encoding) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var foundIndex = -1
  for (var i = byteOffset; i < arrLength; ++i) {
    if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
      if (foundIndex === -1) foundIndex = i
      if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
    } else {
      if (foundIndex !== -1) i -= i - foundIndex
      foundIndex = -1
    }
  }

  return -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  if (Buffer.isBuffer(val)) {
    // special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(this, val, byteOffset, encoding)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset, encoding)
  }

  throw new TypeError('val must be string, number or Buffer')
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start]
    }
  }

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if (code < 256) {
        val = code
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString())
    var len = bytes.length
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":1,"ieee754":12,"isarray":3}],3:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],4:[function(require,module,exports){
(function (Buffer){
var clone = (function() {
'use strict';

/**
 * Clones (copies) an Object using deep copying.
 *
 * This function supports circular references by default, but if you are certain
 * there are no circular references in your object, you can save some CPU time
 * by calling clone(obj, false).
 *
 * Caution: if `circular` is false and `parent` contains circular references,
 * your program may enter an infinite loop and crash.
 *
 * @param `parent` - the object to be cloned
 * @param `circular` - set to true if the object to be cloned may contain
 *    circular references. (optional - true by default)
 * @param `depth` - set to a number if the object is only to be cloned to
 *    a particular depth. (optional - defaults to Infinity)
 * @param `prototype` - sets the prototype to be used when cloning an object.
 *    (optional - defaults to parent prototype).
*/
function clone(parent, circular, depth, prototype) {
  var filter;
  if (typeof circular === 'object') {
    depth = circular.depth;
    prototype = circular.prototype;
    filter = circular.filter;
    circular = circular.circular
  }
  // maintain two arrays for circular references, where corresponding parents
  // and children have the same index
  var allParents = [];
  var allChildren = [];

  var useBuffer = typeof Buffer != 'undefined';

  if (typeof circular == 'undefined')
    circular = true;

  if (typeof depth == 'undefined')
    depth = Infinity;

  // recurse this function so we don't reset allParents and allChildren
  function _clone(parent, depth) {
    // cloning null always returns null
    if (parent === null)
      return null;

    if (depth == 0)
      return parent;

    var child;
    var proto;
    if (typeof parent != 'object') {
      return parent;
    }

    if (clone.__isArray(parent)) {
      child = [];
    } else if (clone.__isRegExp(parent)) {
      child = new RegExp(parent.source, __getRegExpFlags(parent));
      if (parent.lastIndex) child.lastIndex = parent.lastIndex;
    } else if (clone.__isDate(parent)) {
      child = new Date(parent.getTime());
    } else if (useBuffer && Buffer.isBuffer(parent)) {
      child = new Buffer(parent.length);
      parent.copy(child);
      return child;
    } else {
      if (typeof prototype == 'undefined') {
        proto = Object.getPrototypeOf(parent);
        child = Object.create(proto);
      }
      else {
        child = Object.create(prototype);
        proto = prototype;
      }
    }

    if (circular) {
      var index = allParents.indexOf(parent);

      if (index != -1) {
        return allChildren[index];
      }
      allParents.push(parent);
      allChildren.push(child);
    }

    for (var i in parent) {
      var attrs;
      if (proto) {
        attrs = Object.getOwnPropertyDescriptor(proto, i);
      }

      if (attrs && attrs.set == null) {
        continue;
      }
      child[i] = _clone(parent[i], depth - 1);
    }

    return child;
  }

  return _clone(parent, depth);
}

/**
 * Simple flat clone using prototype, accepts only objects, usefull for property
 * override on FLAT configuration object (no nested props).
 *
 * USE WITH CAUTION! This may not behave as you wish if you do not know how this
 * works.
 */
clone.clonePrototype = function clonePrototype(parent) {
  if (parent === null)
    return null;

  var c = function () {};
  c.prototype = parent;
  return new c();
};

// private utility functions

function __objToStr(o) {
  return Object.prototype.toString.call(o);
};
clone.__objToStr = __objToStr;

function __isDate(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Date]';
};
clone.__isDate = __isDate;

function __isArray(o) {
  return typeof o === 'object' && __objToStr(o) === '[object Array]';
};
clone.__isArray = __isArray;

function __isRegExp(o) {
  return typeof o === 'object' && __objToStr(o) === '[object RegExp]';
};
clone.__isRegExp = __isRegExp;

function __getRegExpFlags(re) {
  var flags = '';
  if (re.global) flags += 'g';
  if (re.ignoreCase) flags += 'i';
  if (re.multiline) flags += 'm';
  return flags;
};
clone.__getRegExpFlags = __getRegExpFlags;

return clone;
})();

if (typeof module === 'object' && module.exports) {
  module.exports = clone;
}

}).call(this,require("buffer").Buffer)

},{"buffer":2}],5:[function(require,module,exports){
/* MIT license */
var cssKeywords = require('./css-keywords');

// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

var reverseKeywords = {};
for (var key in cssKeywords) {
	if (cssKeywords.hasOwnProperty(key)) {
		reverseKeywords[cssKeywords[key].join()] = key;
	}
}

var convert = module.exports = {
	rgb: {channels: 3},
	hsl: {channels: 3},
	hsv: {channels: 3},
	hwb: {channels: 3},
	cmyk: {channels: 4},
	xyz: {channels: 3},
	lab: {channels: 3},
	lch: {channels: 3},
	hex: {channels: 1},
	keyword: {channels: 1},
	ansi16: {channels: 1},
	ansi256: {channels: 1},
	hcg: {channels: 3},
	apple: {channels: 3}
};

// hide .channels property
for (var model in convert) {
	if (convert.hasOwnProperty(model)) {
		if (!('channels' in convert[model])) {
			throw new Error('missing channels property: ' + model);
		}

		var channels = convert[model].channels;
		delete convert[model].channels;
		Object.defineProperty(convert[model], 'channels', {value: channels});
	}
}

convert.rgb.hsl = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var min = Math.min(r, g, b);
	var max = Math.max(r, g, b);
	var delta = max - min;
	var h;
	var s;
	var l;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
	var r = rgb[0];
	var g = rgb[1];
	var b = rgb[2];
	var min = Math.min(r, g, b);
	var max = Math.max(r, g, b);
	var delta = max - min;
	var h;
	var s;
	var v;

	if (max === 0) {
		s = 0;
	} else {
		s = (delta / max * 1000) / 10;
	}

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	v = ((max / 255) * 1000) / 10;

	return [h, s, v];
};

convert.rgb.hwb = function (rgb) {
	var r = rgb[0];
	var g = rgb[1];
	var b = rgb[2];
	var h = convert.rgb.hsl(rgb)[0];
	var w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var c;
	var m;
	var y;
	var k;

	k = Math.min(1 - r, 1 - g, 1 - b);
	c = (1 - r - k) / (1 - k) || 0;
	m = (1 - g - k) / (1 - k) || 0;
	y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

convert.rgb.keyword = function (rgb) {
	return reverseKeywords[rgb.join()];
};

convert.keyword.rgb = function (keyword) {
	return cssKeywords[keyword];
};

convert.rgb.xyz = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;

	// assume sRGB
	r = r > 0.04045 ? Math.pow(((r + 0.055) / 1.055), 2.4) : (r / 12.92);
	g = g > 0.04045 ? Math.pow(((g + 0.055) / 1.055), 2.4) : (g / 12.92);
	b = b > 0.04045 ? Math.pow(((b + 0.055) / 1.055), 2.4) : (b / 12.92);

	var x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	var y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	var z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
	var xyz = convert.rgb.xyz(rgb);
	var x = xyz[0];
	var y = xyz[1];
	var z = xyz[2];
	var l;
	var a;
	var b;

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

	l = (116 * y) - 16;
	a = 500 * (x - y);
	b = 200 * (y - z);

	return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
	var h = hsl[0] / 360;
	var s = hsl[1] / 100;
	var l = hsl[2] / 100;
	var t1;
	var t2;
	var t3;
	var rgb;
	var val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	t1 = 2 * l - t2;

	rgb = [0, 0, 0];
	for (var i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}
		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert.hsl.hsv = function (hsl) {
	var h = hsl[0];
	var s = hsl[1] / 100;
	var l = hsl[2] / 100;
	var sv;
	var v;

	if (l === 0) {
		// no need to do calc on black
		// also avoids divide by 0 error
		return [0, 0, 0];
	}

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	v = (l + s) / 2;
	sv = (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
	var h = hsv[0] / 60;
	var s = hsv[1] / 100;
	var v = hsv[2] / 100;
	var hi = Math.floor(h) % 6;

	var f = h - Math.floor(h);
	var p = 255 * v * (1 - s);
	var q = 255 * v * (1 - (s * f));
	var t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert.hsv.hsl = function (hsv) {
	var h = hsv[0];
	var s = hsv[1] / 100;
	var v = hsv[2] / 100;
	var sl;
	var l;

	l = (2 - s) * v;
	sl = s * v;
	sl /= (l <= 1) ? l : 2 - l;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert.hwb.rgb = function (hwb) {
	var h = hwb[0] / 360;
	var wh = hwb[1] / 100;
	var bl = hwb[2] / 100;
	var ratio = wh + bl;
	var i;
	var v;
	var f;
	var n;

	// wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	i = Math.floor(6 * h);
	v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	n = wh + f * (v - wh); // linear interpolation

	var r;
	var g;
	var b;
	switch (i) {
		default:
		case 6:
		case 0: r = v; g = n; b = wh; break;
		case 1: r = n; g = v; b = wh; break;
		case 2: r = wh; g = v; b = n; break;
		case 3: r = wh; g = n; b = v; break;
		case 4: r = n; g = wh; b = v; break;
		case 5: r = v; g = wh; b = n; break;
	}

	return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
	var c = cmyk[0] / 100;
	var m = cmyk[1] / 100;
	var y = cmyk[2] / 100;
	var k = cmyk[3] / 100;
	var r;
	var g;
	var b;

	r = 1 - Math.min(1, c * (1 - k) + k);
	g = 1 - Math.min(1, m * (1 - k) + k);
	b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
	var x = xyz[0] / 100;
	var y = xyz[1] / 100;
	var z = xyz[2] / 100;
	var r;
	var g;
	var b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// assume sRGB
	r = r > 0.0031308
		? ((1.055 * Math.pow(r, 1.0 / 2.4)) - 0.055)
		: r *= 12.92;

	g = g > 0.0031308
		? ((1.055 * Math.pow(g, 1.0 / 2.4)) - 0.055)
		: g *= 12.92;

	b = b > 0.0031308
		? ((1.055 * Math.pow(b, 1.0 / 2.4)) - 0.055)
		: b *= 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
	var x = xyz[0];
	var y = xyz[1];
	var z = xyz[2];
	var l;
	var a;
	var b;

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? Math.pow(x, 1 / 3) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? Math.pow(y, 1 / 3) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? Math.pow(z, 1 / 3) : (7.787 * z) + (16 / 116);

	l = (116 * y) - 16;
	a = 500 * (x - y);
	b = 200 * (y - z);

	return [l, a, b];
};

convert.lab.xyz = function (lab) {
	var l = lab[0];
	var a = lab[1];
	var b = lab[2];
	var x;
	var y;
	var z;
	var y2;

	if (l <= 8) {
		y = (l * 100) / 903.3;
		y2 = (7.787 * (y / 100)) + (16 / 116);
	} else {
		y = 100 * Math.pow((l + 16) / 116, 3);
		y2 = Math.pow(y / 100, 1 / 3);
	}

	x = x / 95.047 <= 0.008856
		? x = (95.047 * ((a / 500) + y2 - (16 / 116))) / 7.787
		: 95.047 * Math.pow((a / 500) + y2, 3);
	z = z / 108.883 <= 0.008859
		? z = (108.883 * (y2 - (b / 200) - (16 / 116))) / 7.787
		: 108.883 * Math.pow(y2 - (b / 200), 3);

	return [x, y, z];
};

convert.lab.lch = function (lab) {
	var l = lab[0];
	var a = lab[1];
	var b = lab[2];
	var hr;
	var h;
	var c;

	hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert.lch.lab = function (lch) {
	var l = lch[0];
	var c = lch[1];
	var h = lch[2];
	var a;
	var b;
	var hr;

	hr = h / 360 * 2 * Math.PI;
	a = c * Math.cos(hr);
	b = c * Math.sin(hr);

	return [l, a, b];
};

convert.rgb.ansi16 = function (args) {
	var r = args[0];
	var g = args[1];
	var b = args[2];
	var value = 1 in arguments ? arguments[1] : convert.rgb.hsv(args)[2]; // hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	var ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert.hsv.ansi16 = function (args) {
	// optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
	var r = args[0];
	var g = args[1];
	var b = args[2];

	// we use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	var ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert.ansi16.rgb = function (args) {
	var color = args % 10;

	// handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	var mult = (~~(args > 50) + 1) * 0.5;
	var r = ((color & 1) * mult) * 255;
	var g = (((color >> 1) & 1) * mult) * 255;
	var b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert.ansi256.rgb = function (args) {
	// handle greyscale
	if (args >= 232) {
		var c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	var rem;
	var r = Math.floor(args / 36) / 5 * 255;
	var g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	var b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert.rgb.hex = function (args) {
	var integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	var string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
	var match = args.toString(16).match(/[a-f0-9]{6}/i);
	if (!match) {
		return [0, 0, 0];
	}

	var integer = parseInt(match[0], 16);
	var r = (integer >> 16) & 0xFF;
	var g = (integer >> 8) & 0xFF;
	var b = integer & 0xFF;

	return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
	var r = rgb[0] / 255;
	var g = rgb[1] / 255;
	var b = rgb[2] / 255;
	var max = Math.max(Math.max(r, g), b);
	var min = Math.min(Math.min(r, g), b);
	var chroma = (max - min);
	var grayscale;
	var hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma + 4;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
	var s = hsl[1] / 100;
	var l = hsl[2] / 100;
	var c = 1;
	var f = 0;

	if (l < 0.5) {
		c = 2.0 * s * l;
	} else {
		c = 2.0 * s * (1.0 - l);
	}

	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
	var s = hsv[1] / 100;
	var v = hsv[2] / 100;

	var c = s * v;
	var f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
	var h = hcg[0] / 360;
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	var pure = [0, 0, 0];
	var hi = (h % 1) * 6;
	var v = hi % 1;
	var w = 1 - v;
	var mg = 0;

	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert.hcg.hsv = function (hcg) {
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;

	var v = c + g * (1.0 - c);
	var f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;

	var l = g * (1.0 - c) + 0.5 * c;
	var s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
	var c = hcg[1] / 100;
	var g = hcg[2] / 100;
	var v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
	var w = hwb[1] / 100;
	var b = hwb[2] / 100;
	var v = 1 - b;
	var c = v - w;
	var g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

},{"./css-keywords":6}],6:[function(require,module,exports){
module.exports = {
	aliceblue: [240, 248, 255],
	antiquewhite: [250, 235, 215],
	aqua: [0, 255, 255],
	aquamarine: [127, 255, 212],
	azure: [240, 255, 255],
	beige: [245, 245, 220],
	bisque: [255, 228, 196],
	black: [0, 0, 0],
	blanchedalmond: [255, 235, 205],
	blue: [0, 0, 255],
	blueviolet: [138, 43, 226],
	brown: [165, 42, 42],
	burlywood: [222, 184, 135],
	cadetblue: [95, 158, 160],
	chartreuse: [127, 255, 0],
	chocolate: [210, 105, 30],
	coral: [255, 127, 80],
	cornflowerblue: [100, 149, 237],
	cornsilk: [255, 248, 220],
	crimson: [220, 20, 60],
	cyan: [0, 255, 255],
	darkblue: [0, 0, 139],
	darkcyan: [0, 139, 139],
	darkgoldenrod: [184, 134, 11],
	darkgray: [169, 169, 169],
	darkgreen: [0, 100, 0],
	darkgrey: [169, 169, 169],
	darkkhaki: [189, 183, 107],
	darkmagenta: [139, 0, 139],
	darkolivegreen: [85, 107, 47],
	darkorange: [255, 140, 0],
	darkorchid: [153, 50, 204],
	darkred: [139, 0, 0],
	darksalmon: [233, 150, 122],
	darkseagreen: [143, 188, 143],
	darkslateblue: [72, 61, 139],
	darkslategray: [47, 79, 79],
	darkslategrey: [47, 79, 79],
	darkturquoise: [0, 206, 209],
	darkviolet: [148, 0, 211],
	deeppink: [255, 20, 147],
	deepskyblue: [0, 191, 255],
	dimgray: [105, 105, 105],
	dimgrey: [105, 105, 105],
	dodgerblue: [30, 144, 255],
	firebrick: [178, 34, 34],
	floralwhite: [255, 250, 240],
	forestgreen: [34, 139, 34],
	fuchsia: [255, 0, 255],
	gainsboro: [220, 220, 220],
	ghostwhite: [248, 248, 255],
	gold: [255, 215, 0],
	goldenrod: [218, 165, 32],
	gray: [128, 128, 128],
	green: [0, 128, 0],
	greenyellow: [173, 255, 47],
	grey: [128, 128, 128],
	honeydew: [240, 255, 240],
	hotpink: [255, 105, 180],
	indianred: [205, 92, 92],
	indigo: [75, 0, 130],
	ivory: [255, 255, 240],
	khaki: [240, 230, 140],
	lavender: [230, 230, 250],
	lavenderblush: [255, 240, 245],
	lawngreen: [124, 252, 0],
	lemonchiffon: [255, 250, 205],
	lightblue: [173, 216, 230],
	lightcoral: [240, 128, 128],
	lightcyan: [224, 255, 255],
	lightgoldenrodyellow: [250, 250, 210],
	lightgray: [211, 211, 211],
	lightgreen: [144, 238, 144],
	lightgrey: [211, 211, 211],
	lightpink: [255, 182, 193],
	lightsalmon: [255, 160, 122],
	lightseagreen: [32, 178, 170],
	lightskyblue: [135, 206, 250],
	lightslategray: [119, 136, 153],
	lightslategrey: [119, 136, 153],
	lightsteelblue: [176, 196, 222],
	lightyellow: [255, 255, 224],
	lime: [0, 255, 0],
	limegreen: [50, 205, 50],
	linen: [250, 240, 230],
	magenta: [255, 0, 255],
	maroon: [128, 0, 0],
	mediumaquamarine: [102, 205, 170],
	mediumblue: [0, 0, 205],
	mediumorchid: [186, 85, 211],
	mediumpurple: [147, 112, 219],
	mediumseagreen: [60, 179, 113],
	mediumslateblue: [123, 104, 238],
	mediumspringgreen: [0, 250, 154],
	mediumturquoise: [72, 209, 204],
	mediumvioletred: [199, 21, 133],
	midnightblue: [25, 25, 112],
	mintcream: [245, 255, 250],
	mistyrose: [255, 228, 225],
	moccasin: [255, 228, 181],
	navajowhite: [255, 222, 173],
	navy: [0, 0, 128],
	oldlace: [253, 245, 230],
	olive: [128, 128, 0],
	olivedrab: [107, 142, 35],
	orange: [255, 165, 0],
	orangered: [255, 69, 0],
	orchid: [218, 112, 214],
	palegoldenrod: [238, 232, 170],
	palegreen: [152, 251, 152],
	paleturquoise: [175, 238, 238],
	palevioletred: [219, 112, 147],
	papayawhip: [255, 239, 213],
	peachpuff: [255, 218, 185],
	peru: [205, 133, 63],
	pink: [255, 192, 203],
	plum: [221, 160, 221],
	powderblue: [176, 224, 230],
	purple: [128, 0, 128],
	rebeccapurple: [102, 51, 153],
	red: [255, 0, 0],
	rosybrown: [188, 143, 143],
	royalblue: [65, 105, 225],
	saddlebrown: [139, 69, 19],
	salmon: [250, 128, 114],
	sandybrown: [244, 164, 96],
	seagreen: [46, 139, 87],
	seashell: [255, 245, 238],
	sienna: [160, 82, 45],
	silver: [192, 192, 192],
	skyblue: [135, 206, 235],
	slateblue: [106, 90, 205],
	slategray: [112, 128, 144],
	slategrey: [112, 128, 144],
	snow: [255, 250, 250],
	springgreen: [0, 255, 127],
	steelblue: [70, 130, 180],
	tan: [210, 180, 140],
	teal: [0, 128, 128],
	thistle: [216, 191, 216],
	tomato: [255, 99, 71],
	turquoise: [64, 224, 208],
	violet: [238, 130, 238],
	wheat: [245, 222, 179],
	white: [255, 255, 255],
	whitesmoke: [245, 245, 245],
	yellow: [255, 255, 0],
	yellowgreen: [154, 205, 50]
};


},{}],7:[function(require,module,exports){
var conversions = require('./conversions');
var route = require('./route');

var convert = {};

var models = Object.keys(conversions);

function wrapRaw(fn) {
	var wrappedFn = function (args) {
		if (args === undefined || args === null) {
			return args;
		}

		if (arguments.length > 1) {
			args = Array.prototype.slice.call(arguments);
		}

		return fn(args);
	};

	// preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	var wrappedFn = function (args) {
		if (args === undefined || args === null) {
			return args;
		}

		if (arguments.length > 1) {
			args = Array.prototype.slice.call(arguments);
		}

		var result = fn(args);

		// we're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (var len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(function (fromModel) {
	convert[fromModel] = {};

	Object.defineProperty(convert[fromModel], 'channels', {value: conversions[fromModel].channels});

	var routes = route(fromModel);
	var routeModels = Object.keys(routes);

	routeModels.forEach(function (toModel) {
		var fn = routes[toModel];

		convert[fromModel][toModel] = wrapRounded(fn);
		convert[fromModel][toModel].raw = wrapRaw(fn);
	});
});

module.exports = convert;

},{"./conversions":5,"./route":8}],8:[function(require,module,exports){
var conversions = require('./conversions');

/*
	this function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

// https://jsperf.com/object-keys-vs-for-in-with-closure/3
var models = Object.keys(conversions);

function buildGraph() {
	var graph = {};

	for (var len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	var graph = buildGraph();
	var queue = [fromModel]; // unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		var current = queue.pop();
		var adjacents = Object.keys(conversions[current]);

		for (var len = adjacents.length, i = 0; i < len; i++) {
			var adjacent = adjacents[i];
			var node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	var path = [graph[toModel].parent, toModel];
	var fn = conversions[graph[toModel].parent][toModel];

	var cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

module.exports = function (fromModel) {
	var graph = deriveBFS(fromModel);
	var conversion = {};

	var models = Object.keys(graph);
	for (var len = models.length, i = 0; i < len; i++) {
		var toModel = models[i];
		var node = graph[toModel];

		if (node.parent === null) {
			// no possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};


},{"./conversions":5}],9:[function(require,module,exports){
module.exports = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};
},{}],10:[function(require,module,exports){
/* MIT license */
var colorNames = require('color-name');

module.exports = {
   getRgba: getRgba,
   getHsla: getHsla,
   getRgb: getRgb,
   getHsl: getHsl,
   getHwb: getHwb,
   getAlpha: getAlpha,

   hexString: hexString,
   rgbString: rgbString,
   rgbaString: rgbaString,
   percentString: percentString,
   percentaString: percentaString,
   hslString: hslString,
   hslaString: hslaString,
   hwbString: hwbString,
   keyword: keyword
}

function getRgba(string) {
   if (!string) {
      return;
   }
   var abbr =  /^#([a-fA-F0-9]{3})$/,
       hex =  /^#([a-fA-F0-9]{6})$/,
       rgba = /^rgba?\(\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*,\s*([+-]?\d+)\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)$/,
       per = /^rgba?\(\s*([+-]?[\d\.]+)\%\s*,\s*([+-]?[\d\.]+)\%\s*,\s*([+-]?[\d\.]+)\%\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)$/,
       keyword = /(\D+)/;

   var rgb = [0, 0, 0],
       a = 1,
       match = string.match(abbr);
   if (match) {
      match = match[1];
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = parseInt(match[i] + match[i], 16);
      }
   }
   else if (match = string.match(hex)) {
      match = match[1];
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = parseInt(match.slice(i * 2, i * 2 + 2), 16);
      }
   }
   else if (match = string.match(rgba)) {
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = parseInt(match[i + 1]);
      }
      a = parseFloat(match[4]);
   }
   else if (match = string.match(per)) {
      for (var i = 0; i < rgb.length; i++) {
         rgb[i] = Math.round(parseFloat(match[i + 1]) * 2.55);
      }
      a = parseFloat(match[4]);
   }
   else if (match = string.match(keyword)) {
      if (match[1] == "transparent") {
         return [0, 0, 0, 0];
      }
      rgb = colorNames[match[1]];
      if (!rgb) {
         return;
      }
   }

   for (var i = 0; i < rgb.length; i++) {
      rgb[i] = scale(rgb[i], 0, 255);
   }
   if (!a && a != 0) {
      a = 1;
   }
   else {
      a = scale(a, 0, 1);
   }
   rgb[3] = a;
   return rgb;
}

function getHsla(string) {
   if (!string) {
      return;
   }
   var hsl = /^hsla?\(\s*([+-]?\d+)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)/;
   var match = string.match(hsl);
   if (match) {
      var alpha = parseFloat(match[4]);
      var h = scale(parseInt(match[1]), 0, 360),
          s = scale(parseFloat(match[2]), 0, 100),
          l = scale(parseFloat(match[3]), 0, 100),
          a = scale(isNaN(alpha) ? 1 : alpha, 0, 1);
      return [h, s, l, a];
   }
}

function getHwb(string) {
   if (!string) {
      return;
   }
   var hwb = /^hwb\(\s*([+-]?\d+)(?:deg)?\s*,\s*([+-]?[\d\.]+)%\s*,\s*([+-]?[\d\.]+)%\s*(?:,\s*([+-]?[\d\.]+)\s*)?\)/;
   var match = string.match(hwb);
   if (match) {
    var alpha = parseFloat(match[4]);
      var h = scale(parseInt(match[1]), 0, 360),
          w = scale(parseFloat(match[2]), 0, 100),
          b = scale(parseFloat(match[3]), 0, 100),
          a = scale(isNaN(alpha) ? 1 : alpha, 0, 1);
      return [h, w, b, a];
   }
}

function getRgb(string) {
   var rgba = getRgba(string);
   return rgba && rgba.slice(0, 3);
}

function getHsl(string) {
  var hsla = getHsla(string);
  return hsla && hsla.slice(0, 3);
}

function getAlpha(string) {
   var vals = getRgba(string);
   if (vals) {
      return vals[3];
   }
   else if (vals = getHsla(string)) {
      return vals[3];
   }
   else if (vals = getHwb(string)) {
      return vals[3];
   }
}

// generators
function hexString(rgb) {
   return "#" + hexDouble(rgb[0]) + hexDouble(rgb[1])
              + hexDouble(rgb[2]);
}

function rgbString(rgba, alpha) {
   if (alpha < 1 || (rgba[3] && rgba[3] < 1)) {
      return rgbaString(rgba, alpha);
   }
   return "rgb(" + rgba[0] + ", " + rgba[1] + ", " + rgba[2] + ")";
}

function rgbaString(rgba, alpha) {
   if (alpha === undefined) {
      alpha = (rgba[3] !== undefined ? rgba[3] : 1);
   }
   return "rgba(" + rgba[0] + ", " + rgba[1] + ", " + rgba[2]
           + ", " + alpha + ")";
}

function percentString(rgba, alpha) {
   if (alpha < 1 || (rgba[3] && rgba[3] < 1)) {
      return percentaString(rgba, alpha);
   }
   var r = Math.round(rgba[0]/255 * 100),
       g = Math.round(rgba[1]/255 * 100),
       b = Math.round(rgba[2]/255 * 100);

   return "rgb(" + r + "%, " + g + "%, " + b + "%)";
}

function percentaString(rgba, alpha) {
   var r = Math.round(rgba[0]/255 * 100),
       g = Math.round(rgba[1]/255 * 100),
       b = Math.round(rgba[2]/255 * 100);
   return "rgba(" + r + "%, " + g + "%, " + b + "%, " + (alpha || rgba[3] || 1) + ")";
}

function hslString(hsla, alpha) {
   if (alpha < 1 || (hsla[3] && hsla[3] < 1)) {
      return hslaString(hsla, alpha);
   }
   return "hsl(" + hsla[0] + ", " + hsla[1] + "%, " + hsla[2] + "%)";
}

function hslaString(hsla, alpha) {
   if (alpha === undefined) {
      alpha = (hsla[3] !== undefined ? hsla[3] : 1);
   }
   return "hsla(" + hsla[0] + ", " + hsla[1] + "%, " + hsla[2] + "%, "
           + alpha + ")";
}

// hwb is a bit different than rgb(a) & hsl(a) since there is no alpha specific syntax
// (hwb have alpha optional & 1 is default value)
function hwbString(hwb, alpha) {
   if (alpha === undefined) {
      alpha = (hwb[3] !== undefined ? hwb[3] : 1);
   }
   return "hwb(" + hwb[0] + ", " + hwb[1] + "%, " + hwb[2] + "%"
           + (alpha !== undefined && alpha !== 1 ? ", " + alpha : "") + ")";
}

function keyword(rgb) {
  return reverseNames[rgb.slice(0, 3)];
}

// helpers
function scale(num, min, max) {
   return Math.min(Math.max(min, num), max);
}

function hexDouble(num) {
  var str = num.toString(16).toUpperCase();
  return (str.length < 2) ? "0" + str : str;
}


//create a list of reverse color names
var reverseNames = {};
for (var name in colorNames) {
   reverseNames[colorNames[name]] = name;
}

},{"color-name":9}],11:[function(require,module,exports){
/* MIT license */
var clone = require('clone');
var convert = require('color-convert');
var string = require('color-string');

var Color = function (obj) {
	if (obj instanceof Color) {
		return obj;
	}
	if (!(this instanceof Color)) {
		return new Color(obj);
	}

	this.values = {
		rgb: [0, 0, 0],
		hsl: [0, 0, 0],
		hsv: [0, 0, 0],
		hwb: [0, 0, 0],
		cmyk: [0, 0, 0, 0],
		alpha: 1
	};

	// parse Color() argument
	var vals;
	if (typeof obj === 'string') {
		vals = string.getRgba(obj);
		if (vals) {
			this.setValues('rgb', vals);
		} else if (vals = string.getHsla(obj)) {
			this.setValues('hsl', vals);
		} else if (vals = string.getHwb(obj)) {
			this.setValues('hwb', vals);
		} else {
			throw new Error('Unable to parse color from string "' + obj + '"');
		}
	} else if (typeof obj === 'object') {
		vals = obj;
		if (vals.r !== undefined || vals.red !== undefined) {
			this.setValues('rgb', vals);
		} else if (vals.l !== undefined || vals.lightness !== undefined) {
			this.setValues('hsl', vals);
		} else if (vals.v !== undefined || vals.value !== undefined) {
			this.setValues('hsv', vals);
		} else if (vals.w !== undefined || vals.whiteness !== undefined) {
			this.setValues('hwb', vals);
		} else if (vals.c !== undefined || vals.cyan !== undefined) {
			this.setValues('cmyk', vals);
		} else {
			throw new Error('Unable to parse color from object ' + JSON.stringify(obj));
		}
	}
};

Color.prototype = {
	rgb: function () {
		return this.setSpace('rgb', arguments);
	},
	hsl: function () {
		return this.setSpace('hsl', arguments);
	},
	hsv: function () {
		return this.setSpace('hsv', arguments);
	},
	hwb: function () {
		return this.setSpace('hwb', arguments);
	},
	cmyk: function () {
		return this.setSpace('cmyk', arguments);
	},

	rgbArray: function () {
		return this.values.rgb;
	},
	hslArray: function () {
		return this.values.hsl;
	},
	hsvArray: function () {
		return this.values.hsv;
	},
	hwbArray: function () {
		if (this.values.alpha !== 1) {
			return this.values.hwb.concat([this.values.alpha]);
		}
		return this.values.hwb;
	},
	cmykArray: function () {
		return this.values.cmyk;
	},
	rgbaArray: function () {
		var rgb = this.values.rgb;
		return rgb.concat([this.values.alpha]);
	},
	hslaArray: function () {
		var hsl = this.values.hsl;
		return hsl.concat([this.values.alpha]);
	},
	alpha: function (val) {
		if (val === undefined) {
			return this.values.alpha;
		}
		this.setValues('alpha', val);
		return this;
	},

	red: function (val) {
		return this.setChannel('rgb', 0, val);
	},
	green: function (val) {
		return this.setChannel('rgb', 1, val);
	},
	blue: function (val) {
		return this.setChannel('rgb', 2, val);
	},
	hue: function (val) {
		if (val) {
			val %= 360;
			val = val < 0 ? 360 + val : val;
		}
		return this.setChannel('hsl', 0, val);
	},
	saturation: function (val) {
		return this.setChannel('hsl', 1, val);
	},
	lightness: function (val) {
		return this.setChannel('hsl', 2, val);
	},
	saturationv: function (val) {
		return this.setChannel('hsv', 1, val);
	},
	whiteness: function (val) {
		return this.setChannel('hwb', 1, val);
	},
	blackness: function (val) {
		return this.setChannel('hwb', 2, val);
	},
	value: function (val) {
		return this.setChannel('hsv', 2, val);
	},
	cyan: function (val) {
		return this.setChannel('cmyk', 0, val);
	},
	magenta: function (val) {
		return this.setChannel('cmyk', 1, val);
	},
	yellow: function (val) {
		return this.setChannel('cmyk', 2, val);
	},
	black: function (val) {
		return this.setChannel('cmyk', 3, val);
	},

	hexString: function () {
		return string.hexString(this.values.rgb);
	},
	rgbString: function () {
		return string.rgbString(this.values.rgb, this.values.alpha);
	},
	rgbaString: function () {
		return string.rgbaString(this.values.rgb, this.values.alpha);
	},
	percentString: function () {
		return string.percentString(this.values.rgb, this.values.alpha);
	},
	hslString: function () {
		return string.hslString(this.values.hsl, this.values.alpha);
	},
	hslaString: function () {
		return string.hslaString(this.values.hsl, this.values.alpha);
	},
	hwbString: function () {
		return string.hwbString(this.values.hwb, this.values.alpha);
	},
	keyword: function () {
		return string.keyword(this.values.rgb, this.values.alpha);
	},

	rgbNumber: function () {
		return (this.values.rgb[0] << 16) | (this.values.rgb[1] << 8) | this.values.rgb[2];
	},

	luminosity: function () {
		// http://www.w3.org/TR/WCAG20/#relativeluminancedef
		var rgb = this.values.rgb;
		var lum = [];
		for (var i = 0; i < rgb.length; i++) {
			var chan = rgb[i] / 255;
			lum[i] = (chan <= 0.03928) ? chan / 12.92 : Math.pow(((chan + 0.055) / 1.055), 2.4);
		}
		return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2];
	},

	contrast: function (color2) {
		// http://www.w3.org/TR/WCAG20/#contrast-ratiodef
		var lum1 = this.luminosity();
		var lum2 = color2.luminosity();
		if (lum1 > lum2) {
			return (lum1 + 0.05) / (lum2 + 0.05);
		}
		return (lum2 + 0.05) / (lum1 + 0.05);
	},

	level: function (color2) {
		var contrastRatio = this.contrast(color2);
		if (contrastRatio >= 7.1) {
			return 'AAA';
		}

		return (contrastRatio >= 4.5) ? 'AA' : '';
	},

	dark: function () {
		// YIQ equation from http://24ways.org/2010/calculating-color-contrast
		var rgb = this.values.rgb;
		var yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
		return yiq < 128;
	},

	light: function () {
		return !this.dark();
	},

	negate: function () {
		var rgb = [];
		for (var i = 0; i < 3; i++) {
			rgb[i] = 255 - this.values.rgb[i];
		}
		this.setValues('rgb', rgb);
		return this;
	},

	lighten: function (ratio) {
		this.values.hsl[2] += this.values.hsl[2] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	darken: function (ratio) {
		this.values.hsl[2] -= this.values.hsl[2] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	saturate: function (ratio) {
		this.values.hsl[1] += this.values.hsl[1] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	desaturate: function (ratio) {
		this.values.hsl[1] -= this.values.hsl[1] * ratio;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	whiten: function (ratio) {
		this.values.hwb[1] += this.values.hwb[1] * ratio;
		this.setValues('hwb', this.values.hwb);
		return this;
	},

	blacken: function (ratio) {
		this.values.hwb[2] += this.values.hwb[2] * ratio;
		this.setValues('hwb', this.values.hwb);
		return this;
	},

	greyscale: function () {
		var rgb = this.values.rgb;
		// http://en.wikipedia.org/wiki/Grayscale#Converting_color_to_grayscale
		var val = rgb[0] * 0.3 + rgb[1] * 0.59 + rgb[2] * 0.11;
		this.setValues('rgb', [val, val, val]);
		return this;
	},

	clearer: function (ratio) {
		this.setValues('alpha', this.values.alpha - (this.values.alpha * ratio));
		return this;
	},

	opaquer: function (ratio) {
		this.setValues('alpha', this.values.alpha + (this.values.alpha * ratio));
		return this;
	},

	rotate: function (degrees) {
		var hue = this.values.hsl[0];
		hue = (hue + degrees) % 360;
		hue = hue < 0 ? 360 + hue : hue;
		this.values.hsl[0] = hue;
		this.setValues('hsl', this.values.hsl);
		return this;
	},

	/**
	 * Ported from sass implementation in C
	 * https://github.com/sass/libsass/blob/0e6b4a2850092356aa3ece07c6b249f0221caced/functions.cpp#L209
	 */
	mix: function (mixinColor, weight) {
		var color1 = this;
		var color2 = mixinColor;
		var p = weight === undefined ? 0.5 : weight;

		var w = 2 * p - 1;
		var a = color1.alpha() - color2.alpha();

		var w1 = (((w * a === -1) ? w : (w + a) / (1 + w * a)) + 1) / 2.0;
		var w2 = 1 - w1;

		return this
			.rgb(
				w1 * color1.red() + w2 * color2.red(),
				w1 * color1.green() + w2 * color2.green(),
				w1 * color1.blue() + w2 * color2.blue()
			)
			.alpha(color1.alpha() * p + color2.alpha() * (1 - p));
	},

	toJSON: function () {
		return this.rgb();
	},

	clone: function () {
		var col = new Color();
		col.values = clone(this.values);
		return col;
	}
};

Color.prototype.getValues = function (space) {
	var vals = {};

	for (var i = 0; i < space.length; i++) {
		vals[space.charAt(i)] = this.values[space][i];
	}

	if (this.values.alpha !== 1) {
		vals.a = this.values.alpha;
	}

	// {r: 255, g: 255, b: 255, a: 0.4}
	return vals;
};

Color.prototype.setValues = function (space, vals) {
	var spaces = {
		rgb: ['red', 'green', 'blue'],
		hsl: ['hue', 'saturation', 'lightness'],
		hsv: ['hue', 'saturation', 'value'],
		hwb: ['hue', 'whiteness', 'blackness'],
		cmyk: ['cyan', 'magenta', 'yellow', 'black']
	};

	var maxes = {
		rgb: [255, 255, 255],
		hsl: [360, 100, 100],
		hsv: [360, 100, 100],
		hwb: [360, 100, 100],
		cmyk: [100, 100, 100, 100]
	};

	var i;
	var alpha = 1;
	if (space === 'alpha') {
		alpha = vals;
	} else if (vals.length) {
		// [10, 10, 10]
		this.values[space] = vals.slice(0, space.length);
		alpha = vals[space.length];
	} else if (vals[space.charAt(0)] !== undefined) {
		// {r: 10, g: 10, b: 10}
		for (i = 0; i < space.length; i++) {
			this.values[space][i] = vals[space.charAt(i)];
		}

		alpha = vals.a;
	} else if (vals[spaces[space][0]] !== undefined) {
		// {red: 10, green: 10, blue: 10}
		var chans = spaces[space];

		for (i = 0; i < space.length; i++) {
			this.values[space][i] = vals[chans[i]];
		}

		alpha = vals.alpha;
	}

	this.values.alpha = Math.max(0, Math.min(1, (alpha === undefined ? this.values.alpha : alpha)));

	if (space === 'alpha') {
		return false;
	}

	var capped;

	// cap values of the space prior converting all values
	for (i = 0; i < space.length; i++) {
		capped = Math.max(0, Math.min(maxes[space][i], this.values[space][i]));
		this.values[space][i] = Math.round(capped);
	}

	// convert to all the other color spaces
	for (var sname in spaces) {
		if (sname !== space) {
			this.values[sname] = convert[space][sname](this.values[space]);
		}

		// cap values
		for (i = 0; i < sname.length; i++) {
			capped = Math.max(0, Math.min(maxes[sname][i], this.values[sname][i]));
			this.values[sname][i] = Math.round(capped);
		}
	}

	return true;
};

Color.prototype.setSpace = function (space, args) {
	var vals = args[0];

	if (vals === undefined) {
		// color.rgb()
		return this.getValues(space);
	}

	// color.rgb(10, 10, 10)
	if (typeof vals === 'number') {
		vals = Array.prototype.slice.call(args);
	}

	this.setValues(space, vals);
	return this;
};

Color.prototype.setChannel = function (space, index, val) {
	if (val === undefined) {
		// color.red()
		return this.values[space][index];
	} else if (val === this.values[space][index]) {
		// color.red(color.red())
		return this;
	}

	// color.red(100)
	this.values[space][index] = val;
	this.setValues(space, this.values[space]);

	return this;
};

module.exports = Color;

},{"clone":4,"color-convert":7,"color-string":10}],12:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],13:[function(require,module,exports){
module.exports = [
	'#01888C', // teal
  '#FC7500', // bright orange
  '#034F5D', // dark teal
  '#F73F01', // orangered
  '#FC1960', // magenta
  '#C7144C', // raspberry
  '#F3C100', // goldenrod
  '#1598F2', // lightning blue
  '#2465E1', // sail blue
  '#F19E02', // gold
]

},{}],14:[function(require,module,exports){
var MersenneTwister = require('mersenne-twister');
var paperGen = require('./paper')
var Color = require('color')
var colors = require('./colors')
var shapeCount = 4

module.exports = generateIdenticon

var generator
function generateIdenticon(diameter, seed) {
  generator = new MersenneTwister(seed);

  var elements = paperGen(diameter)
  var paper = elements.paper
  var container = elements.container

  var remainingColors = hueShift(colors.slice(), generator)


  var bkgnd = paper.rect(0, 0, diameter, diameter);
  bkgnd.attr("fill", genColor(remainingColors));
  bkgnd.attr('stroke', 'none');

  for(var i = 0; i < shapeCount - 1; i++) {
    genShape(paper, remainingColors, diameter, i, shapeCount - 1)
  }

  return container
}

function genShape(paper, remainingColors, diameter, i, total) {
  var shape = paper.rect(0, 0, diameter, diameter);
  shape.rotate(360 * generator.random())

  var trans = diameter / total * generator.random() + (i * diameter / total)
  shape.translate(trans)

  shape.rotate(180 * generator.random())
  shape.attr('fill', genColor(remainingColors));
  shape.attr('stroke', 'none');
}

function genColor(colors) {
  var rand = generator.random()
  var idx = Math.floor(colors.length * generator.random())
  var color = colors.splice(idx,1)[0]
  return color
}

var wobble = 30
function hueShift(colors, generator) {
  var amount = (generator.random() * 30) - (wobble / 2)
  return colors.map(function(hex) {
    var color = Color(hex)
    color.rotate(amount)
    return color.hexString()
  })
}

},{"./colors":13,"./paper":15,"color":11,"mersenne-twister":16}],15:[function(require,module,exports){
var Raphael = require('raphael')

function newPaper(diameter) {
  var container = document.createElement('div')
  container.style.borderRadius = '50px'
  container.style.overflow = 'hidden'
  container.style.padding = '0px'
  container.style.margin = '0px'
  container.style.width = '' + diameter + 'px'
  container.style.height = '' + diameter + 'px'
  container.style.display = 'inline-block'
  var paper = Raphael(container, 100, 100);
  return {
    paper: paper,
    container: container,
  }
}

module.exports = newPaper

},{"raphael":17}],16:[function(require,module,exports){
/*
  https://github.com/banksean wrapped Makoto Matsumoto and Takuji Nishimura's code in a namespace
  so it's better encapsulated. Now you can have multiple random number generators
  and they won't stomp all over eachother's state.
  
  If you want to use this as a substitute for Math.random(), use the random()
  method like so:
  
  var m = new MersenneTwister();
  var randomNumber = m.random();
  
  You can also call the other genrand_{foo}() methods on the instance.
 
  If you want to use a specific seed in order to get a repeatable random
  sequence, pass an integer into the constructor:
 
  var m = new MersenneTwister(123);
 
  and that will always produce the same random sequence.
 
  Sean McCullough (banksean@gmail.com)
*/
 
/* 
   A C-program for MT19937, with initialization improved 2002/1/26.
   Coded by Takuji Nishimura and Makoto Matsumoto.
 
   Before using, initialize the state by using init_seed(seed)  
   or init_by_array(init_key, key_length).
 
   Copyright (C) 1997 - 2002, Makoto Matsumoto and Takuji Nishimura,
   All rights reserved.                          
 
   Redistribution and use in source and binary forms, with or without
   modification, are permitted provided that the following conditions
   are met:
 
     1. Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.
 
     2. Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in the
        documentation and/or other materials provided with the distribution.
 
     3. The names of its contributors may not be used to endorse or promote 
        products derived from this software without specific prior written 
        permission.
 
   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
   "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
   A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT OWNER OR
   CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
   EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
   PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
   PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
   LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
   SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 
 
   Any feedback is very welcome.
   http://www.math.sci.hiroshima-u.ac.jp/~m-mat/MT/emt.html
   email: m-mat @ math.sci.hiroshima-u.ac.jp (remove space)
*/
 
var MersenneTwister = function(seed) {
	if (seed == undefined) {
		seed = new Date().getTime();
	} 

	/* Period parameters */  
	this.N = 624;
	this.M = 397;
	this.MATRIX_A = 0x9908b0df;   /* constant vector a */
	this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
	this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

	this.mt = new Array(this.N); /* the array for the state vector */
	this.mti=this.N+1; /* mti==N+1 means mt[N] is not initialized */

	this.init_seed(seed);
}  

/* initializes mt[N] with a seed */
/* origin name init_genrand */
MersenneTwister.prototype.init_seed = function(s) {
	this.mt[0] = s >>> 0;
	for (this.mti=1; this.mti<this.N; this.mti++) {
		var s = this.mt[this.mti-1] ^ (this.mt[this.mti-1] >>> 30);
		this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253)
		+ this.mti;
		/* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
		/* In the previous versions, MSBs of the seed affect   */
		/* only MSBs of the array mt[].                        */
		/* 2002/01/09 modified by Makoto Matsumoto             */
		this.mt[this.mti] >>>= 0;
		/* for >32 bit machines */
	}
}

/* initialize by an array with array-length */
/* init_key is the array for initializing keys */
/* key_length is its length */
/* slight change for C++, 2004/2/26 */
MersenneTwister.prototype.init_by_array = function(init_key, key_length) {
	var i, j, k;
	this.init_seed(19650218);
	i=1; j=0;
	k = (this.N>key_length ? this.N : key_length);
	for (; k; k--) {
		var s = this.mt[i-1] ^ (this.mt[i-1] >>> 30)
		this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525)))
		+ init_key[j] + j; /* non linear */
		this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
		i++; j++;
		if (i>=this.N) { this.mt[0] = this.mt[this.N-1]; i=1; }
		if (j>=key_length) j=0;
	}
	for (k=this.N-1; k; k--) {
		var s = this.mt[i-1] ^ (this.mt[i-1] >>> 30);
		this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941))
		- i; /* non linear */
		this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
		i++;
		if (i>=this.N) { this.mt[0] = this.mt[this.N-1]; i=1; }
	}

	this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */ 
}

/* generates a random number on [0,0xffffffff]-interval */
/* origin name genrand_int32 */
MersenneTwister.prototype.random_int = function() {
	var y;
	var mag01 = new Array(0x0, this.MATRIX_A);
	/* mag01[x] = x * MATRIX_A  for x=0,1 */

	if (this.mti >= this.N) { /* generate N words at one time */
		var kk;

		if (this.mti == this.N+1)  /* if init_seed() has not been called, */
			this.init_seed(5489);  /* a default initial seed is used */

		for (kk=0;kk<this.N-this.M;kk++) {
			y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk+1]&this.LOWER_MASK);
			this.mt[kk] = this.mt[kk+this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
		}
		for (;kk<this.N-1;kk++) {
			y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk+1]&this.LOWER_MASK);
			this.mt[kk] = this.mt[kk+(this.M-this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
		}
		y = (this.mt[this.N-1]&this.UPPER_MASK)|(this.mt[0]&this.LOWER_MASK);
		this.mt[this.N-1] = this.mt[this.M-1] ^ (y >>> 1) ^ mag01[y & 0x1];

		this.mti = 0;
	}

	y = this.mt[this.mti++];

	/* Tempering */
	y ^= (y >>> 11);
	y ^= (y << 7) & 0x9d2c5680;
	y ^= (y << 15) & 0xefc60000;
	y ^= (y >>> 18);

	return y >>> 0;
}

/* generates a random number on [0,0x7fffffff]-interval */
/* origin name genrand_int31 */
MersenneTwister.prototype.random_int31 = function() {
	return (this.random_int()>>>1);
}

/* generates a random number on [0,1]-real-interval */
/* origin name genrand_real1 */
MersenneTwister.prototype.random_incl = function() {
	return this.random_int()*(1.0/4294967295.0); 
	/* divided by 2^32-1 */ 
}

/* generates a random number on [0,1)-real-interval */
MersenneTwister.prototype.random = function() {
	return this.random_int()*(1.0/4294967296.0); 
	/* divided by 2^32 */
}

/* generates a random number on (0,1)-real-interval */
/* origin name genrand_real3 */
MersenneTwister.prototype.random_excl = function() {
	return (this.random_int() + 0.5)*(1.0/4294967296.0); 
	/* divided by 2^32 */
}

/* generates a random number on [0,1) with 53-bit resolution*/
/* origin name genrand_res53 */
MersenneTwister.prototype.random_long = function() { 
	var a=this.random_int()>>>5, b=this.random_int()>>>6; 
	return(a*67108864.0+b)*(1.0/9007199254740992.0); 
} 

/* These real versions are due to Isaku Wada, 2002/01/09 added */

module.exports = MersenneTwister;

},{}],17:[function(require,module,exports){
!function t(e,r){"object"==typeof exports&&"object"==typeof module?module.exports=r():"function"==typeof define&&define.amd?define([],r):"object"==typeof exports?exports.Raphael=r():e.Raphael=r()}(this,function(){return function(t){function e(i){if(r[i])return r[i].exports;var n=r[i]={exports:{},id:i,loaded:!1};return t[i].call(n.exports,n,n.exports,e),n.loaded=!0,n.exports}var r={};return e.m=t,e.c=r,e.p="",e(0)}([function(t,e,r){var i,n;i=[r(1),r(3),r(4)],n=function(t){return t}.apply(e,i),!(void 0!==n&&(t.exports=n))},function(t,e,r){var i,n;i=[r(2)],n=function(t){function e(r){if(e.is(r,"function"))return w?r():t.on("raphael.DOMload",r);if(e.is(r,Q))return e._engine.create[z](e,r.splice(0,3+e.is(r[0],$))).add(r);var i=Array.prototype.slice.call(arguments,0);if(e.is(i[i.length-1],"function")){var n=i.pop();return w?n.call(e._engine.create[z](e,i)):t.on("raphael.DOMload",function(){n.call(e._engine.create[z](e,i))})}return e._engine.create[z](e,arguments)}function r(t){if("function"==typeof t||Object(t)!==t)return t;var e=new t.constructor;for(var i in t)t[T](i)&&(e[i]=r(t[i]));return e}function i(t,e){for(var r=0,i=t.length;i>r;r++)if(t[r]===e)return t.push(t.splice(r,1)[0])}function n(t,e,r){function n(){var a=Array.prototype.slice.call(arguments,0),s=a.join("␀"),o=n.cache=n.cache||{},l=n.count=n.count||[];return o[T](s)?(i(l,s),r?r(o[s]):o[s]):(l.length>=1e3&&delete o[l.shift()],l.push(s),o[s]=t[z](e,a),r?r(o[s]):o[s])}return n}function a(){return this.hex}function s(t,e){for(var r=[],i=0,n=t.length;n-2*!e>i;i+=2){var a=[{x:+t[i-2],y:+t[i-1]},{x:+t[i],y:+t[i+1]},{x:+t[i+2],y:+t[i+3]},{x:+t[i+4],y:+t[i+5]}];e?i?n-4==i?a[3]={x:+t[0],y:+t[1]}:n-2==i&&(a[2]={x:+t[0],y:+t[1]},a[3]={x:+t[2],y:+t[3]}):a[0]={x:+t[n-2],y:+t[n-1]}:n-4==i?a[3]=a[2]:i||(a[0]={x:+t[i],y:+t[i+1]}),r.push(["C",(-a[0].x+6*a[1].x+a[2].x)/6,(-a[0].y+6*a[1].y+a[2].y)/6,(a[1].x+6*a[2].x-a[3].x)/6,(a[1].y+6*a[2].y-a[3].y)/6,a[2].x,a[2].y])}return r}function o(t,e,r,i,n){var a=-3*e+9*r-9*i+3*n,s=t*a+6*e-12*r+6*i;return t*s-3*e+3*r}function l(t,e,r,i,n,a,s,l,h){null==h&&(h=1),h=h>1?1:0>h?0:h;for(var u=h/2,c=12,f=[-.1252,.1252,-.3678,.3678,-.5873,.5873,-.7699,.7699,-.9041,.9041,-.9816,.9816],p=[.2491,.2491,.2335,.2335,.2032,.2032,.1601,.1601,.1069,.1069,.0472,.0472],d=0,g=0;c>g;g++){var x=u*f[g]+u,v=o(x,t,r,n,s),y=o(x,e,i,a,l),m=v*v+y*y;d+=p[g]*Y.sqrt(m)}return u*d}function h(t,e,r,i,n,a,s,o,h){if(!(0>h||l(t,e,r,i,n,a,s,o)<h)){var u=1,c=u/2,f=u-c,p,d=.01;for(p=l(t,e,r,i,n,a,s,o,f);H(p-h)>d;)c/=2,f+=(h>p?1:-1)*c,p=l(t,e,r,i,n,a,s,o,f);return f}}function u(t,e,r,i,n,a,s,o){if(!(W(t,r)<G(n,s)||G(t,r)>W(n,s)||W(e,i)<G(a,o)||G(e,i)>W(a,o))){var l=(t*i-e*r)*(n-s)-(t-r)*(n*o-a*s),h=(t*i-e*r)*(a-o)-(e-i)*(n*o-a*s),u=(t-r)*(a-o)-(e-i)*(n-s);if(u){var c=l/u,f=h/u,p=+c.toFixed(2),d=+f.toFixed(2);if(!(p<+G(t,r).toFixed(2)||p>+W(t,r).toFixed(2)||p<+G(n,s).toFixed(2)||p>+W(n,s).toFixed(2)||d<+G(e,i).toFixed(2)||d>+W(e,i).toFixed(2)||d<+G(a,o).toFixed(2)||d>+W(a,o).toFixed(2)))return{x:c,y:f}}}}function c(t,e){return p(t,e)}function f(t,e){return p(t,e,1)}function p(t,r,i){var n=e.bezierBBox(t),a=e.bezierBBox(r);if(!e.isBBoxIntersect(n,a))return i?0:[];for(var s=l.apply(0,t),o=l.apply(0,r),h=W(~~(s/5),1),c=W(~~(o/5),1),f=[],p=[],d={},g=i?0:[],x=0;h+1>x;x++){var v=e.findDotsAtSegment.apply(e,t.concat(x/h));f.push({x:v.x,y:v.y,t:x/h})}for(x=0;c+1>x;x++)v=e.findDotsAtSegment.apply(e,r.concat(x/c)),p.push({x:v.x,y:v.y,t:x/c});for(x=0;h>x;x++)for(var y=0;c>y;y++){var m=f[x],b=f[x+1],_=p[y],w=p[y+1],k=H(b.x-m.x)<.001?"y":"x",B=H(w.x-_.x)<.001?"y":"x",C=u(m.x,m.y,b.x,b.y,_.x,_.y,w.x,w.y);if(C){if(d[C.x.toFixed(4)]==C.y.toFixed(4))continue;d[C.x.toFixed(4)]=C.y.toFixed(4);var S=m.t+H((C[k]-m[k])/(b[k]-m[k]))*(b.t-m.t),T=_.t+H((C[B]-_[B])/(w[B]-_[B]))*(w.t-_.t);S>=0&&1.001>=S&&T>=0&&1.001>=T&&(i?g++:g.push({x:C.x,y:C.y,t1:G(S,1),t2:G(T,1)}))}}return g}function d(t,r,i){t=e._path2curve(t),r=e._path2curve(r);for(var n,a,s,o,l,h,u,c,f,d,g=i?0:[],x=0,v=t.length;v>x;x++){var y=t[x];if("M"==y[0])n=l=y[1],a=h=y[2];else{"C"==y[0]?(f=[n,a].concat(y.slice(1)),n=f[6],a=f[7]):(f=[n,a,n,a,l,h,l,h],n=l,a=h);for(var m=0,b=r.length;b>m;m++){var _=r[m];if("M"==_[0])s=u=_[1],o=c=_[2];else{"C"==_[0]?(d=[s,o].concat(_.slice(1)),s=d[6],o=d[7]):(d=[s,o,s,o,u,c,u,c],s=u,o=c);var w=p(f,d,i);if(i)g+=w;else{for(var k=0,B=w.length;B>k;k++)w[k].segment1=x,w[k].segment2=m,w[k].bez1=f,w[k].bez2=d;g=g.concat(w)}}}}}return g}function g(t,e,r,i,n,a){null!=t?(this.a=+t,this.b=+e,this.c=+r,this.d=+i,this.e=+n,this.f=+a):(this.a=1,this.b=0,this.c=0,this.d=1,this.e=0,this.f=0)}function x(){return this.x+I+this.y}function v(){return this.x+I+this.y+I+this.width+" × "+this.height}function y(t,e,r,i,n,a){function s(t){return((c*t+u)*t+h)*t}function o(t,e){var r=l(t,e);return((d*r+p)*r+f)*r}function l(t,e){var r,i,n,a,o,l;for(n=t,l=0;8>l;l++){if(a=s(n)-t,H(a)<e)return n;if(o=(3*c*n+2*u)*n+h,H(o)<1e-6)break;n-=a/o}if(r=0,i=1,n=t,r>n)return r;if(n>i)return i;for(;i>r;){if(a=s(n),H(a-t)<e)return n;t>a?r=n:i=n,n=(i-r)/2+r}return n}var h=3*e,u=3*(i-e)-h,c=1-h-u,f=3*r,p=3*(n-r)-f,d=1-f-p;return o(t,1/(200*a))}function m(t,e){var r=[],i={};if(this.ms=e,this.times=1,t){for(var n in t)t[T](n)&&(i[ht(n)]=t[n],r.push(ht(n)));r.sort(Bt)}this.anim=i,this.top=r[r.length-1],this.percents=r}function b(r,i,n,a,s,o){n=ht(n);var l,h,u,c=[],f,p,d,x=r.ms,v={},m={},b={};if(a)for(w=0,B=Ee.length;B>w;w++){var _=Ee[w];if(_.el.id==i.id&&_.anim==r){_.percent!=n?(Ee.splice(w,1),u=1):h=_,i.attr(_.totalOrigin);break}}else a=+m;for(var w=0,B=r.percents.length;B>w;w++){if(r.percents[w]==n||r.percents[w]>a*r.top){n=r.percents[w],p=r.percents[w-1]||0,x=x/r.top*(n-p),f=r.percents[w+1],l=r.anim[n];break}a&&i.attr(r.anim[r.percents[w]])}if(l){if(h)h.initstatus=a,h.start=new Date-h.ms*a;else{for(var C in l)if(l[T](C)&&(pt[T](C)||i.paper.customAttributes[T](C)))switch(v[C]=i.attr(C),null==v[C]&&(v[C]=ft[C]),m[C]=l[C],pt[C]){case $:b[C]=(m[C]-v[C])/x;break;case"colour":v[C]=e.getRGB(v[C]);var S=e.getRGB(m[C]);b[C]={r:(S.r-v[C].r)/x,g:(S.g-v[C].g)/x,b:(S.b-v[C].b)/x};break;case"path":var A=Qt(v[C],m[C]),E=A[1];for(v[C]=A[0],b[C]=[],w=0,B=v[C].length;B>w;w++){b[C][w]=[0];for(var N=1,M=v[C][w].length;M>N;N++)b[C][w][N]=(E[w][N]-v[C][w][N])/x}break;case"transform":var L=i._,z=le(L[C],m[C]);if(z)for(v[C]=z.from,m[C]=z.to,b[C]=[],b[C].real=!0,w=0,B=v[C].length;B>w;w++)for(b[C][w]=[v[C][w][0]],N=1,M=v[C][w].length;M>N;N++)b[C][w][N]=(m[C][w][N]-v[C][w][N])/x;else{var F=i.matrix||new g,R={_:{transform:L.transform},getBBox:function(){return i.getBBox(1)}};v[C]=[F.a,F.b,F.c,F.d,F.e,F.f],se(R,m[C]),m[C]=R._.transform,b[C]=[(R.matrix.a-F.a)/x,(R.matrix.b-F.b)/x,(R.matrix.c-F.c)/x,(R.matrix.d-F.d)/x,(R.matrix.e-F.e)/x,(R.matrix.f-F.f)/x]}break;case"csv":var I=j(l[C])[q](k),D=j(v[C])[q](k);if("clip-rect"==C)for(v[C]=D,b[C]=[],w=D.length;w--;)b[C][w]=(I[w]-v[C][w])/x;m[C]=I;break;default:for(I=[][P](l[C]),D=[][P](v[C]),b[C]=[],w=i.paper.customAttributes[C].length;w--;)b[C][w]=((I[w]||0)-(D[w]||0))/x}var V=l.easing,O=e.easing_formulas[V];if(!O)if(O=j(V).match(st),O&&5==O.length){var Y=O;O=function(t){return y(t,+Y[1],+Y[2],+Y[3],+Y[4],x)}}else O=St;if(d=l.start||r.start||+new Date,_={anim:r,percent:n,timestamp:d,start:d+(r.del||0),status:0,initstatus:a||0,stop:!1,ms:x,easing:O,from:v,diff:b,to:m,el:i,callback:l.callback,prev:p,next:f,repeat:o||r.times,origin:i.attr(),totalOrigin:s},Ee.push(_),a&&!h&&!u&&(_.stop=!0,_.start=new Date-x*a,1==Ee.length))return Me();u&&(_.start=new Date-_.ms*a),1==Ee.length&&Ne(Me)}t("raphael.anim.start."+i.id,i,r)}}function _(t){for(var e=0;e<Ee.length;e++)Ee[e].el.paper==t&&Ee.splice(e--,1)}e.version="2.2.0",e.eve=t;var w,k=/[, ]+/,B={circle:1,rect:1,path:1,ellipse:1,text:1,image:1},C=/\{(\d+)\}/g,S="prototype",T="hasOwnProperty",A={doc:document,win:window},E={was:Object.prototype[T].call(A.win,"Raphael"),is:A.win.Raphael},N=function(){this.ca=this.customAttributes={}},M,L="appendChild",z="apply",P="concat",F="ontouchstart"in A.win||A.win.DocumentTouch&&A.doc instanceof DocumentTouch,R="",I=" ",j=String,q="split",D="click dblclick mousedown mousemove mouseout mouseover mouseup touchstart touchmove touchend touchcancel"[q](I),V={mousedown:"touchstart",mousemove:"touchmove",mouseup:"touchend"},O=j.prototype.toLowerCase,Y=Math,W=Y.max,G=Y.min,H=Y.abs,X=Y.pow,U=Y.PI,$="number",Z="string",Q="array",J="toString",K="fill",tt=Object.prototype.toString,et={},rt="push",it=e._ISURL=/^url\(['"]?(.+?)['"]?\)$/i,nt=/^\s*((#[a-f\d]{6})|(#[a-f\d]{3})|rgba?\(\s*([\d\.]+%?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+%?(?:\s*,\s*[\d\.]+%?)?)\s*\)|hsba?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\)|hsla?\(\s*([\d\.]+(?:deg|\xb0|%)?\s*,\s*[\d\.]+%?\s*,\s*[\d\.]+(?:%?\s*,\s*[\d\.]+)?)%?\s*\))\s*$/i,at={NaN:1,Infinity:1,"-Infinity":1},st=/^(?:cubic-)?bezier\(([^,]+),([^,]+),([^,]+),([^\)]+)\)/,ot=Y.round,lt="setAttribute",ht=parseFloat,ut=parseInt,ct=j.prototype.toUpperCase,ft=e._availableAttrs={"arrow-end":"none","arrow-start":"none",blur:0,"clip-rect":"0 0 1e9 1e9",cursor:"default",cx:0,cy:0,fill:"#fff","fill-opacity":1,font:'10px "Arial"',"font-family":'"Arial"',"font-size":"10","font-style":"normal","font-weight":400,gradient:0,height:0,href:"http://raphaeljs.com/","letter-spacing":0,opacity:1,path:"M0,0",r:0,rx:0,ry:0,src:"",stroke:"#000","stroke-dasharray":"","stroke-linecap":"butt","stroke-linejoin":"butt","stroke-miterlimit":0,"stroke-opacity":1,"stroke-width":1,target:"_blank","text-anchor":"middle",title:"Raphael",transform:"",width:0,x:0,y:0,"class":""},pt=e._availableAnimAttrs={blur:$,"clip-rect":"csv",cx:$,cy:$,fill:"colour","fill-opacity":$,"font-size":$,height:$,opacity:$,path:"path",r:$,rx:$,ry:$,stroke:"colour","stroke-opacity":$,"stroke-width":$,transform:"transform",width:$,x:$,y:$},dt=/[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]/g,gt=/[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*/,xt={hs:1,rg:1},vt=/,?([achlmqrstvxz]),?/gi,yt=/([achlmrqstvz])[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*)+)/gi,mt=/([rstm])[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*)+)/gi,bt=/(-?\d*\.?\d*(?:e[\-+]?\d+)?)[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*/gi,_t=e._radial_gradient=/^r(?:\(([^,]+?)[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*([^\)]+?)\))?/,wt={},kt=function(t,e){return t.key-e.key},Bt=function(t,e){return ht(t)-ht(e)},Ct=function(){},St=function(t){return t},Tt=e._rectPath=function(t,e,r,i,n){return n?[["M",t+n,e],["l",r-2*n,0],["a",n,n,0,0,1,n,n],["l",0,i-2*n],["a",n,n,0,0,1,-n,n],["l",2*n-r,0],["a",n,n,0,0,1,-n,-n],["l",0,2*n-i],["a",n,n,0,0,1,n,-n],["z"]]:[["M",t,e],["l",r,0],["l",0,i],["l",-r,0],["z"]]},At=function(t,e,r,i){return null==i&&(i=r),[["M",t,e],["m",0,-i],["a",r,i,0,1,1,0,2*i],["a",r,i,0,1,1,0,-2*i],["z"]]},Et=e._getPath={path:function(t){return t.attr("path")},circle:function(t){var e=t.attrs;return At(e.cx,e.cy,e.r)},ellipse:function(t){var e=t.attrs;return At(e.cx,e.cy,e.rx,e.ry)},rect:function(t){var e=t.attrs;return Tt(e.x,e.y,e.width,e.height,e.r)},image:function(t){var e=t.attrs;return Tt(e.x,e.y,e.width,e.height)},text:function(t){var e=t._getBBox();return Tt(e.x,e.y,e.width,e.height)},set:function(t){var e=t._getBBox();return Tt(e.x,e.y,e.width,e.height)}},Nt=e.mapPath=function(t,e){if(!e)return t;var r,i,n,a,s,o,l;for(t=Qt(t),n=0,s=t.length;s>n;n++)for(l=t[n],a=1,o=l.length;o>a;a+=2)r=e.x(l[a],l[a+1]),i=e.y(l[a],l[a+1]),l[a]=r,l[a+1]=i;return t};if(e._g=A,e.type=A.win.SVGAngle||A.doc.implementation.hasFeature("http://www.w3.org/TR/SVG11/feature#BasicStructure","1.1")?"SVG":"VML","VML"==e.type){var Mt=A.doc.createElement("div"),Lt;if(Mt.innerHTML='<v:shape adj="1"/>',Lt=Mt.firstChild,Lt.style.behavior="url(#default#VML)",!Lt||"object"!=typeof Lt.adj)return e.type=R;Mt=null}e.svg=!(e.vml="VML"==e.type),e._Paper=N,e.fn=M=N.prototype=e.prototype,e._id=0,e._oid=0,e.is=function(t,e){return e=O.call(e),"finite"==e?!at[T](+t):"array"==e?t instanceof Array:"null"==e&&null===t||e==typeof t&&null!==t||"object"==e&&t===Object(t)||"array"==e&&Array.isArray&&Array.isArray(t)||tt.call(t).slice(8,-1).toLowerCase()==e},e.angle=function(t,r,i,n,a,s){if(null==a){var o=t-i,l=r-n;return o||l?(180+180*Y.atan2(-l,-o)/U+360)%360:0}return e.angle(t,r,a,s)-e.angle(i,n,a,s)},e.rad=function(t){return t%360*U/180},e.deg=function(t){return Math.round(180*t/U%360*1e3)/1e3},e.snapTo=function(t,r,i){if(i=e.is(i,"finite")?i:10,e.is(t,Q)){for(var n=t.length;n--;)if(H(t[n]-r)<=i)return t[n]}else{t=+t;var a=r%t;if(i>a)return r-a;if(a>t-i)return r-a+t}return r};var zt=e.createUUID=function(t,e){return function(){return"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(t,e).toUpperCase()}}(/[xy]/g,function(t){var e=16*Y.random()|0,r="x"==t?e:3&e|8;return r.toString(16)});e.setWindow=function(r){t("raphael.setWindow",e,A.win,r),A.win=r,A.doc=A.win.document,e._engine.initWin&&e._engine.initWin(A.win)};var Pt=function(t){if(e.vml){var r=/^\s+|\s+$/g,i;try{var a=new ActiveXObject("htmlfile");a.write("<body>"),a.close(),i=a.body}catch(s){i=createPopup().document.body}var o=i.createTextRange();Pt=n(function(t){try{i.style.color=j(t).replace(r,R);var e=o.queryCommandValue("ForeColor");return e=(255&e)<<16|65280&e|(16711680&e)>>>16,"#"+("000000"+e.toString(16)).slice(-6)}catch(n){return"none"}})}else{var l=A.doc.createElement("i");l.title="Raphaël Colour Picker",l.style.display="none",A.doc.body.appendChild(l),Pt=n(function(t){return l.style.color=t,A.doc.defaultView.getComputedStyle(l,R).getPropertyValue("color")})}return Pt(t)},Ft=function(){return"hsb("+[this.h,this.s,this.b]+")"},Rt=function(){return"hsl("+[this.h,this.s,this.l]+")"},It=function(){return this.hex},jt=function(t,r,i){if(null==r&&e.is(t,"object")&&"r"in t&&"g"in t&&"b"in t&&(i=t.b,r=t.g,t=t.r),null==r&&e.is(t,Z)){var n=e.getRGB(t);t=n.r,r=n.g,i=n.b}return(t>1||r>1||i>1)&&(t/=255,r/=255,i/=255),[t,r,i]},qt=function(t,r,i,n){t*=255,r*=255,i*=255;var a={r:t,g:r,b:i,hex:e.rgb(t,r,i),toString:It};return e.is(n,"finite")&&(a.opacity=n),a};e.color=function(t){var r;return e.is(t,"object")&&"h"in t&&"s"in t&&"b"in t?(r=e.hsb2rgb(t),t.r=r.r,t.g=r.g,t.b=r.b,t.hex=r.hex):e.is(t,"object")&&"h"in t&&"s"in t&&"l"in t?(r=e.hsl2rgb(t),t.r=r.r,t.g=r.g,t.b=r.b,t.hex=r.hex):(e.is(t,"string")&&(t=e.getRGB(t)),e.is(t,"object")&&"r"in t&&"g"in t&&"b"in t?(r=e.rgb2hsl(t),t.h=r.h,t.s=r.s,t.l=r.l,r=e.rgb2hsb(t),t.v=r.b):(t={hex:"none"},t.r=t.g=t.b=t.h=t.s=t.v=t.l=-1)),t.toString=It,t},e.hsb2rgb=function(t,e,r,i){this.is(t,"object")&&"h"in t&&"s"in t&&"b"in t&&(r=t.b,e=t.s,i=t.o,t=t.h),t*=360;var n,a,s,o,l;return t=t%360/60,l=r*e,o=l*(1-H(t%2-1)),n=a=s=r-l,t=~~t,n+=[l,o,0,0,o,l][t],a+=[o,l,l,o,0,0][t],s+=[0,0,o,l,l,o][t],qt(n,a,s,i)},e.hsl2rgb=function(t,e,r,i){this.is(t,"object")&&"h"in t&&"s"in t&&"l"in t&&(r=t.l,e=t.s,t=t.h),(t>1||e>1||r>1)&&(t/=360,e/=100,r/=100),t*=360;var n,a,s,o,l;return t=t%360/60,l=2*e*(.5>r?r:1-r),o=l*(1-H(t%2-1)),n=a=s=r-l/2,t=~~t,n+=[l,o,0,0,o,l][t],a+=[o,l,l,o,0,0][t],s+=[0,0,o,l,l,o][t],qt(n,a,s,i)},e.rgb2hsb=function(t,e,r){r=jt(t,e,r),t=r[0],e=r[1],r=r[2];var i,n,a,s;return a=W(t,e,r),s=a-G(t,e,r),i=0==s?null:a==t?(e-r)/s:a==e?(r-t)/s+2:(t-e)/s+4,i=(i+360)%6*60/360,n=0==s?0:s/a,{h:i,s:n,b:a,toString:Ft}},e.rgb2hsl=function(t,e,r){r=jt(t,e,r),t=r[0],e=r[1],r=r[2];var i,n,a,s,o,l;return s=W(t,e,r),o=G(t,e,r),l=s-o,i=0==l?null:s==t?(e-r)/l:s==e?(r-t)/l+2:(t-e)/l+4,i=(i+360)%6*60/360,a=(s+o)/2,n=0==l?0:.5>a?l/(2*a):l/(2-2*a),{h:i,s:n,l:a,toString:Rt}},e._path2string=function(){return this.join(",").replace(vt,"$1")};var Dt=e._preload=function(t,e){var r=A.doc.createElement("img");r.style.cssText="position:absolute;left:-9999em;top:-9999em",r.onload=function(){e.call(this),this.onload=null,A.doc.body.removeChild(this)},r.onerror=function(){A.doc.body.removeChild(this)},A.doc.body.appendChild(r),r.src=t};e.getRGB=n(function(t){if(!t||(t=j(t)).indexOf("-")+1)return{r:-1,g:-1,b:-1,hex:"none",error:1,toString:a};if("none"==t)return{r:-1,g:-1,b:-1,hex:"none",toString:a};!(xt[T](t.toLowerCase().substring(0,2))||"#"==t.charAt())&&(t=Pt(t));var r,i,n,s,o,l,h,u=t.match(nt);return u?(u[2]&&(s=ut(u[2].substring(5),16),n=ut(u[2].substring(3,5),16),i=ut(u[2].substring(1,3),16)),u[3]&&(s=ut((l=u[3].charAt(3))+l,16),n=ut((l=u[3].charAt(2))+l,16),i=ut((l=u[3].charAt(1))+l,16)),u[4]&&(h=u[4][q](gt),i=ht(h[0]),"%"==h[0].slice(-1)&&(i*=2.55),n=ht(h[1]),"%"==h[1].slice(-1)&&(n*=2.55),s=ht(h[2]),"%"==h[2].slice(-1)&&(s*=2.55),"rgba"==u[1].toLowerCase().slice(0,4)&&(o=ht(h[3])),h[3]&&"%"==h[3].slice(-1)&&(o/=100)),u[5]?(h=u[5][q](gt),i=ht(h[0]),"%"==h[0].slice(-1)&&(i*=2.55),n=ht(h[1]),"%"==h[1].slice(-1)&&(n*=2.55),s=ht(h[2]),"%"==h[2].slice(-1)&&(s*=2.55),("deg"==h[0].slice(-3)||"°"==h[0].slice(-1))&&(i/=360),"hsba"==u[1].toLowerCase().slice(0,4)&&(o=ht(h[3])),h[3]&&"%"==h[3].slice(-1)&&(o/=100),e.hsb2rgb(i,n,s,o)):u[6]?(h=u[6][q](gt),i=ht(h[0]),"%"==h[0].slice(-1)&&(i*=2.55),n=ht(h[1]),"%"==h[1].slice(-1)&&(n*=2.55),s=ht(h[2]),"%"==h[2].slice(-1)&&(s*=2.55),("deg"==h[0].slice(-3)||"°"==h[0].slice(-1))&&(i/=360),"hsla"==u[1].toLowerCase().slice(0,4)&&(o=ht(h[3])),h[3]&&"%"==h[3].slice(-1)&&(o/=100),e.hsl2rgb(i,n,s,o)):(u={r:i,g:n,b:s,toString:a},u.hex="#"+(16777216|s|n<<8|i<<16).toString(16).slice(1),e.is(o,"finite")&&(u.opacity=o),u)):{r:-1,g:-1,b:-1,hex:"none",error:1,toString:a}},e),e.hsb=n(function(t,r,i){return e.hsb2rgb(t,r,i).hex}),e.hsl=n(function(t,r,i){return e.hsl2rgb(t,r,i).hex}),e.rgb=n(function(t,e,r){function i(t){return t+.5|0}return"#"+(16777216|i(r)|i(e)<<8|i(t)<<16).toString(16).slice(1)}),e.getColor=function(t){var e=this.getColor.start=this.getColor.start||{h:0,s:1,b:t||.75},r=this.hsb2rgb(e.h,e.s,e.b);return e.h+=.075,e.h>1&&(e.h=0,e.s-=.2,e.s<=0&&(this.getColor.start={h:0,s:1,b:e.b})),r.hex},e.getColor.reset=function(){delete this.start},e.parsePathString=function(t){if(!t)return null;var r=Vt(t);if(r.arr)return Yt(r.arr);var i={a:7,c:6,h:1,l:2,m:2,r:4,q:4,s:4,t:2,v:1,z:0},n=[];return e.is(t,Q)&&e.is(t[0],Q)&&(n=Yt(t)),n.length||j(t).replace(yt,function(t,e,r){var a=[],s=e.toLowerCase();if(r.replace(bt,function(t,e){e&&a.push(+e)}),"m"==s&&a.length>2&&(n.push([e][P](a.splice(0,2))),s="l",e="m"==e?"l":"L"),"r"==s)n.push([e][P](a));else for(;a.length>=i[s]&&(n.push([e][P](a.splice(0,i[s]))),i[s]););}),n.toString=e._path2string,r.arr=Yt(n),n},e.parseTransformString=n(function(t){if(!t)return null;var r={r:3,s:4,t:2,m:6},i=[];return e.is(t,Q)&&e.is(t[0],Q)&&(i=Yt(t)),i.length||j(t).replace(mt,function(t,e,r){var n=[],a=O.call(e);r.replace(bt,function(t,e){e&&n.push(+e)}),i.push([e][P](n))}),i.toString=e._path2string,i});var Vt=function(t){var e=Vt.ps=Vt.ps||{};return e[t]?e[t].sleep=100:e[t]={sleep:100},setTimeout(function(){for(var r in e)e[T](r)&&r!=t&&(e[r].sleep--,!e[r].sleep&&delete e[r])}),e[t]};e.findDotsAtSegment=function(t,e,r,i,n,a,s,o,l){var h=1-l,u=X(h,3),c=X(h,2),f=l*l,p=f*l,d=u*t+3*c*l*r+3*h*l*l*n+p*s,g=u*e+3*c*l*i+3*h*l*l*a+p*o,x=t+2*l*(r-t)+f*(n-2*r+t),v=e+2*l*(i-e)+f*(a-2*i+e),y=r+2*l*(n-r)+f*(s-2*n+r),m=i+2*l*(a-i)+f*(o-2*a+i),b=h*t+l*r,_=h*e+l*i,w=h*n+l*s,k=h*a+l*o,B=90-180*Y.atan2(x-y,v-m)/U;return(x>y||m>v)&&(B+=180),{x:d,y:g,m:{x:x,y:v},n:{x:y,y:m},start:{x:b,y:_},end:{x:w,y:k},alpha:B}},e.bezierBBox=function(t,r,i,n,a,s,o,l){e.is(t,"array")||(t=[t,r,i,n,a,s,o,l]);var h=Zt.apply(null,t);return{x:h.min.x,y:h.min.y,x2:h.max.x,y2:h.max.y,width:h.max.x-h.min.x,height:h.max.y-h.min.y}},e.isPointInsideBBox=function(t,e,r){return e>=t.x&&e<=t.x2&&r>=t.y&&r<=t.y2},e.isBBoxIntersect=function(t,r){var i=e.isPointInsideBBox;return i(r,t.x,t.y)||i(r,t.x2,t.y)||i(r,t.x,t.y2)||i(r,t.x2,t.y2)||i(t,r.x,r.y)||i(t,r.x2,r.y)||i(t,r.x,r.y2)||i(t,r.x2,r.y2)||(t.x<r.x2&&t.x>r.x||r.x<t.x2&&r.x>t.x)&&(t.y<r.y2&&t.y>r.y||r.y<t.y2&&r.y>t.y)},e.pathIntersection=function(t,e){return d(t,e)},e.pathIntersectionNumber=function(t,e){return d(t,e,1)},e.isPointInsidePath=function(t,r,i){var n=e.pathBBox(t);return e.isPointInsideBBox(n,r,i)&&d(t,[["M",r,i],["H",n.x2+10]],1)%2==1},e._removedFactory=function(e){return function(){t("raphael.log",null,"Raphaël: you are calling to method “"+e+"” of removed object",e)}};var Ot=e.pathBBox=function(t){var e=Vt(t);if(e.bbox)return r(e.bbox);if(!t)return{x:0,y:0,width:0,height:0,x2:0,y2:0};t=Qt(t);for(var i=0,n=0,a=[],s=[],o,l=0,h=t.length;h>l;l++)if(o=t[l],"M"==o[0])i=o[1],n=o[2],a.push(i),s.push(n);else{var u=Zt(i,n,o[1],o[2],o[3],o[4],o[5],o[6]);a=a[P](u.min.x,u.max.x),s=s[P](u.min.y,u.max.y),i=o[5],n=o[6]}var c=G[z](0,a),f=G[z](0,s),p=W[z](0,a),d=W[z](0,s),g=p-c,x=d-f,v={x:c,y:f,x2:p,y2:d,width:g,height:x,cx:c+g/2,cy:f+x/2};return e.bbox=r(v),v},Yt=function(t){var i=r(t);return i.toString=e._path2string,i},Wt=e._pathToRelative=function(t){var r=Vt(t);if(r.rel)return Yt(r.rel);e.is(t,Q)&&e.is(t&&t[0],Q)||(t=e.parsePathString(t));var i=[],n=0,a=0,s=0,o=0,l=0;"M"==t[0][0]&&(n=t[0][1],a=t[0][2],s=n,o=a,l++,i.push(["M",n,a]));for(var h=l,u=t.length;u>h;h++){var c=i[h]=[],f=t[h];if(f[0]!=O.call(f[0]))switch(c[0]=O.call(f[0]),c[0]){case"a":c[1]=f[1],c[2]=f[2],c[3]=f[3],c[4]=f[4],c[5]=f[5],c[6]=+(f[6]-n).toFixed(3),c[7]=+(f[7]-a).toFixed(3);break;case"v":c[1]=+(f[1]-a).toFixed(3);break;case"m":s=f[1],o=f[2];default:for(var p=1,d=f.length;d>p;p++)c[p]=+(f[p]-(p%2?n:a)).toFixed(3)}else{c=i[h]=[],"m"==f[0]&&(s=f[1]+n,o=f[2]+a);for(var g=0,x=f.length;x>g;g++)i[h][g]=f[g]}var v=i[h].length;switch(i[h][0]){case"z":n=s,a=o;break;case"h":n+=+i[h][v-1];break;case"v":a+=+i[h][v-1];break;default:n+=+i[h][v-2],a+=+i[h][v-1]}}return i.toString=e._path2string,r.rel=Yt(i),i},Gt=e._pathToAbsolute=function(t){var r=Vt(t);if(r.abs)return Yt(r.abs);if(e.is(t,Q)&&e.is(t&&t[0],Q)||(t=e.parsePathString(t)),!t||!t.length)return[["M",0,0]];var i=[],n=0,a=0,o=0,l=0,h=0;"M"==t[0][0]&&(n=+t[0][1],a=+t[0][2],o=n,l=a,h++,i[0]=["M",n,a]);for(var u=3==t.length&&"M"==t[0][0]&&"R"==t[1][0].toUpperCase()&&"Z"==t[2][0].toUpperCase(),c,f,p=h,d=t.length;d>p;p++){if(i.push(c=[]),f=t[p],f[0]!=ct.call(f[0]))switch(c[0]=ct.call(f[0]),c[0]){case"A":c[1]=f[1],c[2]=f[2],c[3]=f[3],c[4]=f[4],c[5]=f[5],c[6]=+(f[6]+n),c[7]=+(f[7]+a);break;case"V":c[1]=+f[1]+a;break;case"H":c[1]=+f[1]+n;break;case"R":for(var g=[n,a][P](f.slice(1)),x=2,v=g.length;v>x;x++)g[x]=+g[x]+n,g[++x]=+g[x]+a;i.pop(),i=i[P](s(g,u));break;case"M":o=+f[1]+n,l=+f[2]+a;default:for(x=1,v=f.length;v>x;x++)c[x]=+f[x]+(x%2?n:a)}else if("R"==f[0])g=[n,a][P](f.slice(1)),i.pop(),i=i[P](s(g,u)),c=["R"][P](f.slice(-2));else for(var y=0,m=f.length;m>y;y++)c[y]=f[y];switch(c[0]){case"Z":n=o,a=l;break;case"H":n=c[1];break;case"V":a=c[1];break;case"M":o=c[c.length-2],l=c[c.length-1];default:n=c[c.length-2],a=c[c.length-1]}}return i.toString=e._path2string,r.abs=Yt(i),i},Ht=function(t,e,r,i){return[t,e,r,i,r,i]},Xt=function(t,e,r,i,n,a){var s=1/3,o=2/3;return[s*t+o*r,s*e+o*i,s*n+o*r,s*a+o*i,n,a]},Ut=function(t,e,r,i,a,s,o,l,h,u){var c=120*U/180,f=U/180*(+a||0),p=[],d,g=n(function(t,e,r){var i=t*Y.cos(r)-e*Y.sin(r),n=t*Y.sin(r)+e*Y.cos(r);return{x:i,y:n}});if(u)S=u[0],T=u[1],B=u[2],C=u[3];else{d=g(t,e,-f),t=d.x,e=d.y,d=g(l,h,-f),l=d.x,h=d.y;var x=Y.cos(U/180*a),v=Y.sin(U/180*a),y=(t-l)/2,m=(e-h)/2,b=y*y/(r*r)+m*m/(i*i);b>1&&(b=Y.sqrt(b),r=b*r,i=b*i);var _=r*r,w=i*i,k=(s==o?-1:1)*Y.sqrt(H((_*w-_*m*m-w*y*y)/(_*m*m+w*y*y))),B=k*r*m/i+(t+l)/2,C=k*-i*y/r+(e+h)/2,S=Y.asin(((e-C)/i).toFixed(9)),T=Y.asin(((h-C)/i).toFixed(9));S=B>t?U-S:S,T=B>l?U-T:T,0>S&&(S=2*U+S),0>T&&(T=2*U+T),o&&S>T&&(S-=2*U),!o&&T>S&&(T-=2*U)}var A=T-S;if(H(A)>c){var E=T,N=l,M=h;T=S+c*(o&&T>S?1:-1),l=B+r*Y.cos(T),h=C+i*Y.sin(T),p=Ut(l,h,r,i,a,0,o,N,M,[T,E,B,C])}A=T-S;var L=Y.cos(S),z=Y.sin(S),F=Y.cos(T),R=Y.sin(T),I=Y.tan(A/4),j=4/3*r*I,D=4/3*i*I,V=[t,e],O=[t+j*z,e-D*L],W=[l+j*R,h-D*F],G=[l,h];if(O[0]=2*V[0]-O[0],O[1]=2*V[1]-O[1],u)return[O,W,G][P](p);p=[O,W,G][P](p).join()[q](",");for(var X=[],$=0,Z=p.length;Z>$;$++)X[$]=$%2?g(p[$-1],p[$],f).y:g(p[$],p[$+1],f).x;return X},$t=function(t,e,r,i,n,a,s,o,l){var h=1-l;return{x:X(h,3)*t+3*X(h,2)*l*r+3*h*l*l*n+X(l,3)*s,y:X(h,3)*e+3*X(h,2)*l*i+3*h*l*l*a+X(l,3)*o}},Zt=n(function(t,e,r,i,n,a,s,o){var l=n-2*r+t-(s-2*n+r),h=2*(r-t)-2*(n-r),u=t-r,c=(-h+Y.sqrt(h*h-4*l*u))/2/l,f=(-h-Y.sqrt(h*h-4*l*u))/2/l,p=[e,o],d=[t,s],g;return H(c)>"1e12"&&(c=.5),H(f)>"1e12"&&(f=.5),c>0&&1>c&&(g=$t(t,e,r,i,n,a,s,o,c),d.push(g.x),p.push(g.y)),f>0&&1>f&&(g=$t(t,e,r,i,n,a,s,o,f),d.push(g.x),p.push(g.y)),l=a-2*i+e-(o-2*a+i),h=2*(i-e)-2*(a-i),u=e-i,c=(-h+Y.sqrt(h*h-4*l*u))/2/l,f=(-h-Y.sqrt(h*h-4*l*u))/2/l,H(c)>"1e12"&&(c=.5),H(f)>"1e12"&&(f=.5),c>0&&1>c&&(g=$t(t,e,r,i,n,a,s,o,c),d.push(g.x),p.push(g.y)),f>0&&1>f&&(g=$t(t,e,r,i,n,a,s,o,f),d.push(g.x),p.push(g.y)),{min:{x:G[z](0,d),y:G[z](0,p)},max:{x:W[z](0,d),y:W[z](0,p)}}}),Qt=e._path2curve=n(function(t,e){var r=!e&&Vt(t);if(!e&&r.curve)return Yt(r.curve);for(var i=Gt(t),n=e&&Gt(e),a={x:0,y:0,bx:0,by:0,X:0,Y:0,qx:null,qy:null},s={x:0,y:0,bx:0,by:0,X:0,Y:0,qx:null,qy:null},o=(function(t,e,r){var i,n,a={T:1,Q:1};if(!t)return["C",e.x,e.y,e.x,e.y,e.x,e.y];switch(!(t[0]in a)&&(e.qx=e.qy=null),t[0]){case"M":e.X=t[1],e.Y=t[2];break;case"A":t=["C"][P](Ut[z](0,[e.x,e.y][P](t.slice(1))));break;case"S":"C"==r||"S"==r?(i=2*e.x-e.bx,n=2*e.y-e.by):(i=e.x,n=e.y),t=["C",i,n][P](t.slice(1));break;case"T":"Q"==r||"T"==r?(e.qx=2*e.x-e.qx,e.qy=2*e.y-e.qy):(e.qx=e.x,e.qy=e.y),t=["C"][P](Xt(e.x,e.y,e.qx,e.qy,t[1],t[2]));break;case"Q":e.qx=t[1],e.qy=t[2],t=["C"][P](Xt(e.x,e.y,t[1],t[2],t[3],t[4]));break;case"L":t=["C"][P](Ht(e.x,e.y,t[1],t[2]));break;case"H":t=["C"][P](Ht(e.x,e.y,t[1],e.y));break;case"V":t=["C"][P](Ht(e.x,e.y,e.x,t[1]));break;case"Z":t=["C"][P](Ht(e.x,e.y,e.X,e.Y))}return t}),l=function(t,e){if(t[e].length>7){t[e].shift();for(var r=t[e];r.length;)u[e]="A",n&&(c[e]="A"),t.splice(e++,0,["C"][P](r.splice(0,6)));t.splice(e,1),g=W(i.length,n&&n.length||0)}},h=function(t,e,r,a,s){t&&e&&"M"==t[s][0]&&"M"!=e[s][0]&&(e.splice(s,0,["M",a.x,a.y]),r.bx=0,r.by=0,r.x=t[s][1],r.y=t[s][2],g=W(i.length,n&&n.length||0))},u=[],c=[],f="",p="",d=0,g=W(i.length,n&&n.length||0);g>d;d++){i[d]&&(f=i[d][0]),"C"!=f&&(u[d]=f,d&&(p=u[d-1])),i[d]=o(i[d],a,p),"A"!=u[d]&&"C"==f&&(u[d]="C"),l(i,d),n&&(n[d]&&(f=n[d][0]),"C"!=f&&(c[d]=f,d&&(p=c[d-1])),n[d]=o(n[d],s,p),"A"!=c[d]&&"C"==f&&(c[d]="C"),l(n,d)),h(i,n,a,s,d),h(n,i,s,a,d);var x=i[d],v=n&&n[d],y=x.length,m=n&&v.length;a.x=x[y-2],a.y=x[y-1],a.bx=ht(x[y-4])||a.x,a.by=ht(x[y-3])||a.y,s.bx=n&&(ht(v[m-4])||s.x),s.by=n&&(ht(v[m-3])||s.y),s.x=n&&v[m-2],s.y=n&&v[m-1]}return n||(r.curve=Yt(i)),n?[i,n]:i},null,Yt),Jt=e._parseDots=n(function(t){for(var r=[],i=0,n=t.length;n>i;i++){var a={},s=t[i].match(/^([^:]*):?([\d\.]*)/);if(a.color=e.getRGB(s[1]),a.color.error)return null;a.opacity=a.color.opacity,a.color=a.color.hex,s[2]&&(a.offset=s[2]+"%"),r.push(a)}for(i=1,n=r.length-1;n>i;i++)if(!r[i].offset){for(var o=ht(r[i-1].offset||0),l=0,h=i+1;n>h;h++)if(r[h].offset){l=r[h].offset;break}l||(l=100,h=n),l=ht(l);for(var u=(l-o)/(h-i+1);h>i;i++)o+=u,r[i].offset=o+"%"}return r}),Kt=e._tear=function(t,e){t==e.top&&(e.top=t.prev),t==e.bottom&&(e.bottom=t.next),t.next&&(t.next.prev=t.prev),t.prev&&(t.prev.next=t.next)},te=e._tofront=function(t,e){e.top!==t&&(Kt(t,e),t.next=null,t.prev=e.top,e.top.next=t,e.top=t)},ee=e._toback=function(t,e){e.bottom!==t&&(Kt(t,e),t.next=e.bottom,t.prev=null,e.bottom.prev=t,e.bottom=t)},re=e._insertafter=function(t,e,r){Kt(t,r),e==r.top&&(r.top=t),e.next&&(e.next.prev=t),t.next=e.next,t.prev=e,e.next=t},ie=e._insertbefore=function(t,e,r){Kt(t,r),e==r.bottom&&(r.bottom=t),e.prev&&(e.prev.next=t),t.prev=e.prev,e.prev=t,t.next=e},ne=e.toMatrix=function(t,e){var r=Ot(t),i={_:{transform:R},getBBox:function(){return r}};return se(i,e),i.matrix},ae=e.transformPath=function(t,e){return Nt(t,ne(t,e))},se=e._extractTransform=function(t,r){if(null==r)return t._.transform;r=j(r).replace(/\.{3}|\u2026/g,t._.transform||R);var i=e.parseTransformString(r),n=0,a=0,s=0,o=1,l=1,h=t._,u=new g;if(h.transform=i||[],i)for(var c=0,f=i.length;f>c;c++){var p=i[c],d=p.length,x=j(p[0]).toLowerCase(),v=p[0]!=x,y=v?u.invert():0,m,b,_,w,k;"t"==x&&3==d?v?(m=y.x(0,0),b=y.y(0,0),_=y.x(p[1],p[2]),w=y.y(p[1],p[2]),u.translate(_-m,w-b)):u.translate(p[1],p[2]):"r"==x?2==d?(k=k||t.getBBox(1),u.rotate(p[1],k.x+k.width/2,k.y+k.height/2),n+=p[1]):4==d&&(v?(_=y.x(p[2],p[3]),w=y.y(p[2],p[3]),u.rotate(p[1],_,w)):u.rotate(p[1],p[2],p[3]),n+=p[1]):"s"==x?2==d||3==d?(k=k||t.getBBox(1),u.scale(p[1],p[d-1],k.x+k.width/2,k.y+k.height/2),o*=p[1],l*=p[d-1]):5==d&&(v?(_=y.x(p[3],p[4]),w=y.y(p[3],p[4]),u.scale(p[1],p[2],_,w)):u.scale(p[1],p[2],p[3],p[4]),o*=p[1],l*=p[2]):"m"==x&&7==d&&u.add(p[1],p[2],p[3],p[4],p[5],p[6]),h.dirtyT=1,t.matrix=u}t.matrix=u,h.sx=o,h.sy=l,h.deg=n,h.dx=a=u.e,h.dy=s=u.f,1==o&&1==l&&!n&&h.bbox?(h.bbox.x+=+a,h.bbox.y+=+s):h.dirtyT=1},oe=function(t){var e=t[0];switch(e.toLowerCase()){case"t":return[e,0,0];case"m":return[e,1,0,0,1,0,0];case"r":return 4==t.length?[e,0,t[2],t[3]]:[e,0];case"s":return 5==t.length?[e,1,1,t[3],t[4]]:3==t.length?[e,1,1]:[e,1]}},le=e._equaliseTransform=function(t,r){r=j(r).replace(/\.{3}|\u2026/g,t),t=e.parseTransformString(t)||[],r=e.parseTransformString(r)||[];for(var i=W(t.length,r.length),n=[],a=[],s=0,o,l,h,u;i>s;s++){if(h=t[s]||oe(r[s]),u=r[s]||oe(h),h[0]!=u[0]||"r"==h[0].toLowerCase()&&(h[2]!=u[2]||h[3]!=u[3])||"s"==h[0].toLowerCase()&&(h[3]!=u[3]||h[4]!=u[4]))return;for(n[s]=[],a[s]=[],o=0,l=W(h.length,u.length);l>o;o++)o in h&&(n[s][o]=h[o]),o in u&&(a[s][o]=u[o])}return{from:n,to:a}};e._getContainer=function(t,r,i,n){var a;return a=null!=n||e.is(t,"object")?t:A.doc.getElementById(t),null!=a?a.tagName?null==r?{container:a,width:a.style.pixelWidth||a.offsetWidth,height:a.style.pixelHeight||a.offsetHeight}:{container:a,width:r,height:i}:{container:1,x:t,y:r,width:i,height:n}:void 0},e.pathToRelative=Wt,e._engine={},e.path2curve=Qt,e.matrix=function(t,e,r,i,n,a){return new g(t,e,r,i,n,a)},function(t){function r(t){return t[0]*t[0]+t[1]*t[1]}function i(t){var e=Y.sqrt(r(t));t[0]&&(t[0]/=e),t[1]&&(t[1]/=e)}t.add=function(t,e,r,i,n,a){var s=[[],[],[]],o=[[this.a,this.c,this.e],[this.b,this.d,this.f],[0,0,1]],l=[[t,r,n],[e,i,a],[0,0,1]],h,u,c,f;for(t&&t instanceof g&&(l=[[t.a,t.c,t.e],[t.b,t.d,t.f],[0,0,1]]),h=0;3>h;h++)for(u=0;3>u;u++){for(f=0,c=0;3>c;c++)f+=o[h][c]*l[c][u];s[h][u]=f}this.a=s[0][0],this.b=s[1][0],this.c=s[0][1],this.d=s[1][1],this.e=s[0][2],this.f=s[1][2]},t.invert=function(){var t=this,e=t.a*t.d-t.b*t.c;return new g(t.d/e,-t.b/e,-t.c/e,t.a/e,(t.c*t.f-t.d*t.e)/e,(t.b*t.e-t.a*t.f)/e)},t.clone=function(){return new g(this.a,this.b,this.c,this.d,this.e,this.f)},t.translate=function(t,e){
this.add(1,0,0,1,t,e)},t.scale=function(t,e,r,i){null==e&&(e=t),(r||i)&&this.add(1,0,0,1,r,i),this.add(t,0,0,e,0,0),(r||i)&&this.add(1,0,0,1,-r,-i)},t.rotate=function(t,r,i){t=e.rad(t),r=r||0,i=i||0;var n=+Y.cos(t).toFixed(9),a=+Y.sin(t).toFixed(9);this.add(n,a,-a,n,r,i),this.add(1,0,0,1,-r,-i)},t.x=function(t,e){return t*this.a+e*this.c+this.e},t.y=function(t,e){return t*this.b+e*this.d+this.f},t.get=function(t){return+this[j.fromCharCode(97+t)].toFixed(4)},t.toString=function(){return e.svg?"matrix("+[this.get(0),this.get(1),this.get(2),this.get(3),this.get(4),this.get(5)].join()+")":[this.get(0),this.get(2),this.get(1),this.get(3),0,0].join()},t.toFilter=function(){return"progid:DXImageTransform.Microsoft.Matrix(M11="+this.get(0)+", M12="+this.get(2)+", M21="+this.get(1)+", M22="+this.get(3)+", Dx="+this.get(4)+", Dy="+this.get(5)+", sizingmethod='auto expand')"},t.offset=function(){return[this.e.toFixed(4),this.f.toFixed(4)]},t.split=function(){var t={};t.dx=this.e,t.dy=this.f;var n=[[this.a,this.c],[this.b,this.d]];t.scalex=Y.sqrt(r(n[0])),i(n[0]),t.shear=n[0][0]*n[1][0]+n[0][1]*n[1][1],n[1]=[n[1][0]-n[0][0]*t.shear,n[1][1]-n[0][1]*t.shear],t.scaley=Y.sqrt(r(n[1])),i(n[1]),t.shear/=t.scaley;var a=-n[0][1],s=n[1][1];return 0>s?(t.rotate=e.deg(Y.acos(s)),0>a&&(t.rotate=360-t.rotate)):t.rotate=e.deg(Y.asin(a)),t.isSimple=!(+t.shear.toFixed(9)||t.scalex.toFixed(9)!=t.scaley.toFixed(9)&&t.rotate),t.isSuperSimple=!+t.shear.toFixed(9)&&t.scalex.toFixed(9)==t.scaley.toFixed(9)&&!t.rotate,t.noRotation=!+t.shear.toFixed(9)&&!t.rotate,t},t.toTransformString=function(t){var e=t||this[q]();return e.isSimple?(e.scalex=+e.scalex.toFixed(4),e.scaley=+e.scaley.toFixed(4),e.rotate=+e.rotate.toFixed(4),(e.dx||e.dy?"t"+[e.dx,e.dy]:R)+(1!=e.scalex||1!=e.scaley?"s"+[e.scalex,e.scaley,0,0]:R)+(e.rotate?"r"+[e.rotate,0,0]:R)):"m"+[this.get(0),this.get(1),this.get(2),this.get(3),this.get(4),this.get(5)]}}(g.prototype);for(var he=function(){this.returnValue=!1},ue=function(){return this.originalEvent.preventDefault()},ce=function(){this.cancelBubble=!0},fe=function(){return this.originalEvent.stopPropagation()},pe=function(t){var e=A.doc.documentElement.scrollTop||A.doc.body.scrollTop,r=A.doc.documentElement.scrollLeft||A.doc.body.scrollLeft;return{x:t.clientX+r,y:t.clientY+e}},de=function(){return A.doc.addEventListener?function(t,e,r,i){var n=function(t){var e=pe(t);return r.call(i,t,e.x,e.y)};if(t.addEventListener(e,n,!1),F&&V[e]){var a=function(e){for(var n=pe(e),a=e,s=0,o=e.targetTouches&&e.targetTouches.length;o>s;s++)if(e.targetTouches[s].target==t){e=e.targetTouches[s],e.originalEvent=a,e.preventDefault=ue,e.stopPropagation=fe;break}return r.call(i,e,n.x,n.y)};t.addEventListener(V[e],a,!1)}return function(){return t.removeEventListener(e,n,!1),F&&V[e]&&t.removeEventListener(V[e],a,!1),!0}}:A.doc.attachEvent?function(t,e,r,i){var n=function(t){t=t||A.win.event;var e=A.doc.documentElement.scrollTop||A.doc.body.scrollTop,n=A.doc.documentElement.scrollLeft||A.doc.body.scrollLeft,a=t.clientX+n,s=t.clientY+e;return t.preventDefault=t.preventDefault||he,t.stopPropagation=t.stopPropagation||ce,r.call(i,t,a,s)};t.attachEvent("on"+e,n);var a=function(){return t.detachEvent("on"+e,n),!0};return a}:void 0}(),ge=[],xe=function(e){for(var r=e.clientX,i=e.clientY,n=A.doc.documentElement.scrollTop||A.doc.body.scrollTop,a=A.doc.documentElement.scrollLeft||A.doc.body.scrollLeft,s,o=ge.length;o--;){if(s=ge[o],F&&e.touches){for(var l=e.touches.length,h;l--;)if(h=e.touches[l],h.identifier==s.el._drag.id){r=h.clientX,i=h.clientY,(e.originalEvent?e.originalEvent:e).preventDefault();break}}else e.preventDefault();var u=s.el.node,c,f=u.nextSibling,p=u.parentNode,d=u.style.display;A.win.opera&&p.removeChild(u),u.style.display="none",c=s.el.paper.getElementByPoint(r,i),u.style.display=d,A.win.opera&&(f?p.insertBefore(u,f):p.appendChild(u)),c&&t("raphael.drag.over."+s.el.id,s.el,c),r+=a,i+=n,t("raphael.drag.move."+s.el.id,s.move_scope||s.el,r-s.el._drag.x,i-s.el._drag.y,r,i,e)}},ve=function(r){e.unmousemove(xe).unmouseup(ve);for(var i=ge.length,n;i--;)n=ge[i],n.el._drag={},t("raphael.drag.end."+n.el.id,n.end_scope||n.start_scope||n.move_scope||n.el,r);ge=[]},ye=e.el={},me=D.length;me--;)!function(t){e[t]=ye[t]=function(r,i){return e.is(r,"function")&&(this.events=this.events||[],this.events.push({name:t,f:r,unbind:de(this.shape||this.node||A.doc,t,r,i||this)})),this},e["un"+t]=ye["un"+t]=function(r){for(var i=this.events||[],n=i.length;n--;)i[n].name!=t||!e.is(r,"undefined")&&i[n].f!=r||(i[n].unbind(),i.splice(n,1),!i.length&&delete this.events);return this}}(D[me]);ye.data=function(r,i){var n=wt[this.id]=wt[this.id]||{};if(0==arguments.length)return n;if(1==arguments.length){if(e.is(r,"object")){for(var a in r)r[T](a)&&this.data(a,r[a]);return this}return t("raphael.data.get."+this.id,this,n[r],r),n[r]}return n[r]=i,t("raphael.data.set."+this.id,this,i,r),this},ye.removeData=function(t){return null==t?wt[this.id]={}:wt[this.id]&&delete wt[this.id][t],this},ye.getData=function(){return r(wt[this.id]||{})},ye.hover=function(t,e,r,i){return this.mouseover(t,r).mouseout(e,i||r)},ye.unhover=function(t,e){return this.unmouseover(t).unmouseout(e)};var be=[];ye.drag=function(r,i,n,a,s,o){function l(l){(l.originalEvent||l).preventDefault();var h=l.clientX,u=l.clientY,c=A.doc.documentElement.scrollTop||A.doc.body.scrollTop,f=A.doc.documentElement.scrollLeft||A.doc.body.scrollLeft;if(this._drag.id=l.identifier,F&&l.touches)for(var p=l.touches.length,d;p--;)if(d=l.touches[p],this._drag.id=d.identifier,d.identifier==this._drag.id){h=d.clientX,u=d.clientY;break}this._drag.x=h+f,this._drag.y=u+c,!ge.length&&e.mousemove(xe).mouseup(ve),ge.push({el:this,move_scope:a,start_scope:s,end_scope:o}),i&&t.on("raphael.drag.start."+this.id,i),r&&t.on("raphael.drag.move."+this.id,r),n&&t.on("raphael.drag.end."+this.id,n),t("raphael.drag.start."+this.id,s||a||this,l.clientX+f,l.clientY+c,l)}return this._drag={},be.push({el:this,start:l}),this.mousedown(l),this},ye.onDragOver=function(e){e?t.on("raphael.drag.over."+this.id,e):t.unbind("raphael.drag.over."+this.id)},ye.undrag=function(){for(var r=be.length;r--;)be[r].el==this&&(this.unmousedown(be[r].start),be.splice(r,1),t.unbind("raphael.drag.*."+this.id));!be.length&&e.unmousemove(xe).unmouseup(ve),ge=[]},M.circle=function(t,r,i){var n=e._engine.circle(this,t||0,r||0,i||0);return this.__set__&&this.__set__.push(n),n},M.rect=function(t,r,i,n,a){var s=e._engine.rect(this,t||0,r||0,i||0,n||0,a||0);return this.__set__&&this.__set__.push(s),s},M.ellipse=function(t,r,i,n){var a=e._engine.ellipse(this,t||0,r||0,i||0,n||0);return this.__set__&&this.__set__.push(a),a},M.path=function(t){t&&!e.is(t,Z)&&!e.is(t[0],Q)&&(t+=R);var r=e._engine.path(e.format[z](e,arguments),this);return this.__set__&&this.__set__.push(r),r},M.image=function(t,r,i,n,a){var s=e._engine.image(this,t||"about:blank",r||0,i||0,n||0,a||0);return this.__set__&&this.__set__.push(s),s},M.text=function(t,r,i){var n=e._engine.text(this,t||0,r||0,j(i));return this.__set__&&this.__set__.push(n),n},M.set=function(t){!e.is(t,"array")&&(t=Array.prototype.splice.call(arguments,0,arguments.length));var r=new ze(t);return this.__set__&&this.__set__.push(r),r.paper=this,r.type="set",r},M.setStart=function(t){this.__set__=t||this.set()},M.setFinish=function(t){var e=this.__set__;return delete this.__set__,e},M.getSize=function(){var t=this.canvas.parentNode;return{width:t.offsetWidth,height:t.offsetHeight}},M.setSize=function(t,r){return e._engine.setSize.call(this,t,r)},M.setViewBox=function(t,r,i,n,a){return e._engine.setViewBox.call(this,t,r,i,n,a)},M.top=M.bottom=null,M.raphael=e;var _e=function(t){var e=t.getBoundingClientRect(),r=t.ownerDocument,i=r.body,n=r.documentElement,a=n.clientTop||i.clientTop||0,s=n.clientLeft||i.clientLeft||0,o=e.top+(A.win.pageYOffset||n.scrollTop||i.scrollTop)-a,l=e.left+(A.win.pageXOffset||n.scrollLeft||i.scrollLeft)-s;return{y:o,x:l}};M.getElementByPoint=function(t,e){var r=this,i=r.canvas,n=A.doc.elementFromPoint(t,e);if(A.win.opera&&"svg"==n.tagName){var a=_e(i),s=i.createSVGRect();s.x=t-a.x,s.y=e-a.y,s.width=s.height=1;var o=i.getIntersectionList(s,null);o.length&&(n=o[o.length-1])}if(!n)return null;for(;n.parentNode&&n!=i.parentNode&&!n.raphael;)n=n.parentNode;return n==r.canvas.parentNode&&(n=i),n=n&&n.raphael?r.getById(n.raphaelid):null},M.getElementsByBBox=function(t){var r=this.set();return this.forEach(function(i){e.isBBoxIntersect(i.getBBox(),t)&&r.push(i)}),r},M.getById=function(t){for(var e=this.bottom;e;){if(e.id==t)return e;e=e.next}return null},M.forEach=function(t,e){for(var r=this.bottom;r;){if(t.call(e,r)===!1)return this;r=r.next}return this},M.getElementsByPoint=function(t,e){var r=this.set();return this.forEach(function(i){i.isPointInside(t,e)&&r.push(i)}),r},ye.isPointInside=function(t,r){var i=this.realPath=Et[this.type](this);return this.attr("transform")&&this.attr("transform").length&&(i=e.transformPath(i,this.attr("transform"))),e.isPointInsidePath(i,t,r)},ye.getBBox=function(t){if(this.removed)return{};var e=this._;return t?(!e.dirty&&e.bboxwt||(this.realPath=Et[this.type](this),e.bboxwt=Ot(this.realPath),e.bboxwt.toString=v,e.dirty=0),e.bboxwt):((e.dirty||e.dirtyT||!e.bbox)&&(!e.dirty&&this.realPath||(e.bboxwt=0,this.realPath=Et[this.type](this)),e.bbox=Ot(Nt(this.realPath,this.matrix)),e.bbox.toString=v,e.dirty=e.dirtyT=0),e.bbox)},ye.clone=function(){if(this.removed)return null;var t=this.paper[this.type]().attr(this.attr());return this.__set__&&this.__set__.push(t),t},ye.glow=function(t){if("text"==this.type)return null;t=t||{};var e={width:(t.width||10)+(+this.attr("stroke-width")||1),fill:t.fill||!1,opacity:null==t.opacity?.5:t.opacity,offsetx:t.offsetx||0,offsety:t.offsety||0,color:t.color||"#000"},r=e.width/2,i=this.paper,n=i.set(),a=this.realPath||Et[this.type](this);a=this.matrix?Nt(a,this.matrix):a;for(var s=1;r+1>s;s++)n.push(i.path(a).attr({stroke:e.color,fill:e.fill?e.color:"none","stroke-linejoin":"round","stroke-linecap":"round","stroke-width":+(e.width/r*s).toFixed(3),opacity:+(e.opacity/r).toFixed(3)}));return n.insertBefore(this).translate(e.offsetx,e.offsety)};var we={},ke=function(t,r,i,n,a,s,o,u,c){return null==c?l(t,r,i,n,a,s,o,u):e.findDotsAtSegment(t,r,i,n,a,s,o,u,h(t,r,i,n,a,s,o,u,c))},Be=function(t,r){return function(i,n,a){i=Qt(i);for(var s,o,l,h,u="",c={},f,p=0,d=0,g=i.length;g>d;d++){if(l=i[d],"M"==l[0])s=+l[1],o=+l[2];else{if(h=ke(s,o,l[1],l[2],l[3],l[4],l[5],l[6]),p+h>n){if(r&&!c.start){if(f=ke(s,o,l[1],l[2],l[3],l[4],l[5],l[6],n-p),u+=["C"+f.start.x,f.start.y,f.m.x,f.m.y,f.x,f.y],a)return u;c.start=u,u=["M"+f.x,f.y+"C"+f.n.x,f.n.y,f.end.x,f.end.y,l[5],l[6]].join(),p+=h,s=+l[5],o=+l[6];continue}if(!t&&!r)return f=ke(s,o,l[1],l[2],l[3],l[4],l[5],l[6],n-p),{x:f.x,y:f.y,alpha:f.alpha}}p+=h,s=+l[5],o=+l[6]}u+=l.shift()+l}return c.end=u,f=t?p:r?c:e.findDotsAtSegment(s,o,l[0],l[1],l[2],l[3],l[4],l[5],1),f.alpha&&(f={x:f.x,y:f.y,alpha:f.alpha}),f}},Ce=Be(1),Se=Be(),Te=Be(0,1);e.getTotalLength=Ce,e.getPointAtLength=Se,e.getSubpath=function(t,e,r){if(this.getTotalLength(t)-r<1e-6)return Te(t,e).end;var i=Te(t,r,1);return e?Te(i,e).end:i},ye.getTotalLength=function(){var t=this.getPath();if(t)return this.node.getTotalLength?this.node.getTotalLength():Ce(t)},ye.getPointAtLength=function(t){var e=this.getPath();if(e)return Se(e,t)},ye.getPath=function(){var t,r=e._getPath[this.type];if("text"!=this.type&&"set"!=this.type)return r&&(t=r(this)),t},ye.getSubpath=function(t,r){var i=this.getPath();if(i)return e.getSubpath(i,t,r)};var Ae=e.easing_formulas={linear:function(t){return t},"<":function(t){return X(t,1.7)},">":function(t){return X(t,.48)},"<>":function(t){var e=.48-t/1.04,r=Y.sqrt(.1734+e*e),i=r-e,n=X(H(i),1/3)*(0>i?-1:1),a=-r-e,s=X(H(a),1/3)*(0>a?-1:1),o=n+s+.5;return 3*(1-o)*o*o+o*o*o},backIn:function(t){var e=1.70158;return t*t*((e+1)*t-e)},backOut:function(t){t-=1;var e=1.70158;return t*t*((e+1)*t+e)+1},elastic:function(t){return t==!!t?t:X(2,-10*t)*Y.sin((t-.075)*(2*U)/.3)+1},bounce:function(t){var e=7.5625,r=2.75,i;return 1/r>t?i=e*t*t:2/r>t?(t-=1.5/r,i=e*t*t+.75):2.5/r>t?(t-=2.25/r,i=e*t*t+.9375):(t-=2.625/r,i=e*t*t+.984375),i}};Ae.easeIn=Ae["ease-in"]=Ae["<"],Ae.easeOut=Ae["ease-out"]=Ae[">"],Ae.easeInOut=Ae["ease-in-out"]=Ae["<>"],Ae["back-in"]=Ae.backIn,Ae["back-out"]=Ae.backOut;var Ee=[],Ne=window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(t){setTimeout(t,16)},Me=function(){for(var r=+new Date,i=0;i<Ee.length;i++){var n=Ee[i];if(!n.el.removed&&!n.paused){var a=r-n.start,s=n.ms,o=n.easing,l=n.from,h=n.diff,u=n.to,c=n.t,f=n.el,p={},d,g={},x;if(n.initstatus?(a=(n.initstatus*n.anim.top-n.prev)/(n.percent-n.prev)*s,n.status=n.initstatus,delete n.initstatus,n.stop&&Ee.splice(i--,1)):n.status=(n.prev+(n.percent-n.prev)*(a/s))/n.anim.top,!(0>a))if(s>a){var v=o(a/s);for(var y in l)if(l[T](y)){switch(pt[y]){case $:d=+l[y]+v*s*h[y];break;case"colour":d="rgb("+[Le(ot(l[y].r+v*s*h[y].r)),Le(ot(l[y].g+v*s*h[y].g)),Le(ot(l[y].b+v*s*h[y].b))].join(",")+")";break;case"path":d=[];for(var m=0,_=l[y].length;_>m;m++){d[m]=[l[y][m][0]];for(var w=1,k=l[y][m].length;k>w;w++)d[m][w]=+l[y][m][w]+v*s*h[y][m][w];d[m]=d[m].join(I)}d=d.join(I);break;case"transform":if(h[y].real)for(d=[],m=0,_=l[y].length;_>m;m++)for(d[m]=[l[y][m][0]],w=1,k=l[y][m].length;k>w;w++)d[m][w]=l[y][m][w]+v*s*h[y][m][w];else{var B=function(t){return+l[y][t]+v*s*h[y][t]};d=[["m",B(0),B(1),B(2),B(3),B(4),B(5)]]}break;case"csv":if("clip-rect"==y)for(d=[],m=4;m--;)d[m]=+l[y][m]+v*s*h[y][m];break;default:var C=[][P](l[y]);for(d=[],m=f.paper.customAttributes[y].length;m--;)d[m]=+C[m]+v*s*h[y][m]}p[y]=d}f.attr(p),function(e,r,i){setTimeout(function(){t("raphael.anim.frame."+e,r,i)})}(f.id,f,n.anim)}else{if(function(r,i,n){setTimeout(function(){t("raphael.anim.frame."+i.id,i,n),t("raphael.anim.finish."+i.id,i,n),e.is(r,"function")&&r.call(i)})}(n.callback,f,n.anim),f.attr(u),Ee.splice(i--,1),n.repeat>1&&!n.next){for(x in u)u[T](x)&&(g[x]=n.totalOrigin[x]);n.el.attr(g),b(n.anim,n.el,n.anim.percents[0],null,n.totalOrigin,n.repeat-1)}n.next&&!n.stop&&b(n.anim,n.el,n.next,null,n.totalOrigin,n.repeat)}}}Ee.length&&Ne(Me)},Le=function(t){return t>255?255:0>t?0:t};ye.animateWith=function(t,r,i,n,a,s){var o=this;if(o.removed)return s&&s.call(o),o;var l=i instanceof m?i:e.animation(i,n,a,s),h,u;b(l,o,l.percents[0],null,o.attr());for(var c=0,f=Ee.length;f>c;c++)if(Ee[c].anim==r&&Ee[c].el==t){Ee[f-1].start=Ee[c].start;break}return o},ye.onAnimation=function(e){return e?t.on("raphael.anim.frame."+this.id,e):t.unbind("raphael.anim.frame."+this.id),this},m.prototype.delay=function(t){var e=new m(this.anim,this.ms);return e.times=this.times,e.del=+t||0,e},m.prototype.repeat=function(t){var e=new m(this.anim,this.ms);return e.del=this.del,e.times=Y.floor(W(t,0))||1,e},e.animation=function(t,r,i,n){if(t instanceof m)return t;!e.is(i,"function")&&i||(n=n||i||null,i=null),t=Object(t),r=+r||0;var a={},s,o;for(o in t)t[T](o)&&ht(o)!=o&&ht(o)+"%"!=o&&(s=!0,a[o]=t[o]);if(s)return i&&(a.easing=i),n&&(a.callback=n),new m({100:a},r);if(n){var l=0;for(var h in t){var u=ut(h);t[T](h)&&u>l&&(l=u)}l+="%",!t[l].callback&&(t[l].callback=n)}return new m(t,r)},ye.animate=function(t,r,i,n){var a=this;if(a.removed)return n&&n.call(a),a;var s=t instanceof m?t:e.animation(t,r,i,n);return b(s,a,s.percents[0],null,a.attr()),a},ye.setTime=function(t,e){return t&&null!=e&&this.status(t,G(e,t.ms)/t.ms),this},ye.status=function(t,e){var r=[],i=0,n,a;if(null!=e)return b(t,this,-1,G(e,1)),this;for(n=Ee.length;n>i;i++)if(a=Ee[i],a.el.id==this.id&&(!t||a.anim==t)){if(t)return a.status;r.push({anim:a.anim,status:a.status})}return t?0:r},ye.pause=function(e){for(var r=0;r<Ee.length;r++)Ee[r].el.id!=this.id||e&&Ee[r].anim!=e||t("raphael.anim.pause."+this.id,this,Ee[r].anim)!==!1&&(Ee[r].paused=!0);return this},ye.resume=function(e){for(var r=0;r<Ee.length;r++)if(Ee[r].el.id==this.id&&(!e||Ee[r].anim==e)){var i=Ee[r];t("raphael.anim.resume."+this.id,this,i.anim)!==!1&&(delete i.paused,this.status(i.anim,i.status))}return this},ye.stop=function(e){for(var r=0;r<Ee.length;r++)Ee[r].el.id!=this.id||e&&Ee[r].anim!=e||t("raphael.anim.stop."+this.id,this,Ee[r].anim)!==!1&&Ee.splice(r--,1);return this},t.on("raphael.remove",_),t.on("raphael.clear",_),ye.toString=function(){return"Raphaël’s object"};var ze=function(t){if(this.items=[],this.length=0,this.type="set",t)for(var e=0,r=t.length;r>e;e++)!t[e]||t[e].constructor!=ye.constructor&&t[e].constructor!=ze||(this[this.items.length]=this.items[this.items.length]=t[e],this.length++)},Pe=ze.prototype;Pe.push=function(){for(var t,e,r=0,i=arguments.length;i>r;r++)t=arguments[r],!t||t.constructor!=ye.constructor&&t.constructor!=ze||(e=this.items.length,this[e]=this.items[e]=t,this.length++);return this},Pe.pop=function(){return this.length&&delete this[this.length--],this.items.pop()},Pe.forEach=function(t,e){for(var r=0,i=this.items.length;i>r;r++)if(t.call(e,this.items[r],r)===!1)return this;return this};for(var Fe in ye)ye[T](Fe)&&(Pe[Fe]=function(t){return function(){var e=arguments;return this.forEach(function(r){r[t][z](r,e)})}}(Fe));return Pe.attr=function(t,r){if(t&&e.is(t,Q)&&e.is(t[0],"object"))for(var i=0,n=t.length;n>i;i++)this.items[i].attr(t[i]);else for(var a=0,s=this.items.length;s>a;a++)this.items[a].attr(t,r);return this},Pe.clear=function(){for(;this.length;)this.pop()},Pe.splice=function(t,e,r){t=0>t?W(this.length+t,0):t,e=W(0,G(this.length-t,e));var i=[],n=[],a=[],s;for(s=2;s<arguments.length;s++)a.push(arguments[s]);for(s=0;e>s;s++)n.push(this[t+s]);for(;s<this.length-t;s++)i.push(this[t+s]);var o=a.length;for(s=0;s<o+i.length;s++)this.items[t+s]=this[t+s]=o>s?a[s]:i[s-o];for(s=this.items.length=this.length-=e-o;this[s];)delete this[s++];return new ze(n)},Pe.exclude=function(t){for(var e=0,r=this.length;r>e;e++)if(this[e]==t)return this.splice(e,1),!0},Pe.animate=function(t,r,i,n){(e.is(i,"function")||!i)&&(n=i||null);var a=this.items.length,s=a,o,l=this,h;if(!a)return this;n&&(h=function(){!--a&&n.call(l)}),i=e.is(i,Z)?i:h;var u=e.animation(t,r,i,h);for(o=this.items[--s].animate(u);s--;)this.items[s]&&!this.items[s].removed&&this.items[s].animateWith(o,u,u),this.items[s]&&!this.items[s].removed||a--;return this},Pe.insertAfter=function(t){for(var e=this.items.length;e--;)this.items[e].insertAfter(t);return this},Pe.getBBox=function(){for(var t=[],e=[],r=[],i=[],n=this.items.length;n--;)if(!this.items[n].removed){var a=this.items[n].getBBox();t.push(a.x),e.push(a.y),r.push(a.x+a.width),i.push(a.y+a.height)}return t=G[z](0,t),e=G[z](0,e),r=W[z](0,r),i=W[z](0,i),{x:t,y:e,x2:r,y2:i,width:r-t,height:i-e}},Pe.clone=function(t){t=this.paper.set();for(var e=0,r=this.items.length;r>e;e++)t.push(this.items[e].clone());return t},Pe.toString=function(){return"Raphaël‘s set"},Pe.glow=function(t){var e=this.paper.set();return this.forEach(function(r,i){var n=r.glow(t);null!=n&&n.forEach(function(t,r){e.push(t)})}),e},Pe.isPointInside=function(t,e){var r=!1;return this.forEach(function(i){return i.isPointInside(t,e)?(r=!0,!1):void 0}),r},e.registerFont=function(t){if(!t.face)return t;this.fonts=this.fonts||{};var e={w:t.w,face:{},glyphs:{}},r=t.face["font-family"];for(var i in t.face)t.face[T](i)&&(e.face[i]=t.face[i]);if(this.fonts[r]?this.fonts[r].push(e):this.fonts[r]=[e],!t.svg){e.face["units-per-em"]=ut(t.face["units-per-em"],10);for(var n in t.glyphs)if(t.glyphs[T](n)){var a=t.glyphs[n];if(e.glyphs[n]={w:a.w,k:{},d:a.d&&"M"+a.d.replace(/[mlcxtrv]/g,function(t){return{l:"L",c:"C",x:"z",t:"m",r:"l",v:"c"}[t]||"M"})+"z"},a.k)for(var s in a.k)a[T](s)&&(e.glyphs[n].k[s]=a.k[s])}}return t},M.getFont=function(t,r,i,n){if(n=n||"normal",i=i||"normal",r=+r||{normal:400,bold:700,lighter:300,bolder:800}[r]||400,e.fonts){var a=e.fonts[t];if(!a){var s=new RegExp("(^|\\s)"+t.replace(/[^\w\d\s+!~.:_-]/g,R)+"(\\s|$)","i");for(var o in e.fonts)if(e.fonts[T](o)&&s.test(o)){a=e.fonts[o];break}}var l;if(a)for(var h=0,u=a.length;u>h&&(l=a[h],l.face["font-weight"]!=r||l.face["font-style"]!=i&&l.face["font-style"]||l.face["font-stretch"]!=n);h++);return l}},M.print=function(t,r,i,n,a,s,o,l){s=s||"middle",o=W(G(o||0,1),-1),l=W(G(l||1,3),1);var h=j(i)[q](R),u=0,c=0,f=R,p;if(e.is(n,"string")&&(n=this.getFont(n)),n){p=(a||16)/n.face["units-per-em"];for(var d=n.face.bbox[q](k),g=+d[0],x=d[3]-d[1],v=0,y=+d[1]+("baseline"==s?x+ +n.face.descent:x/2),m=0,b=h.length;b>m;m++){if("\n"==h[m])u=0,w=0,c=0,v+=x*l;else{var _=c&&n.glyphs[h[m-1]]||{},w=n.glyphs[h[m]];u+=c?(_.w||n.w)+(_.k&&_.k[h[m]]||0)+n.w*o:0,c=1}w&&w.d&&(f+=e.transformPath(w.d,["t",u*p,v*p,"s",p,p,g,y,"t",(t-g)/p,(r-y)/p]))}}return this.path(f).attr({fill:"#000",stroke:"none"})},M.add=function(t){if(e.is(t,"array"))for(var r=this.set(),i=0,n=t.length,a;n>i;i++)a=t[i]||{},B[T](a.type)&&r.push(this[a.type]().attr(a));return r},e.format=function(t,r){var i=e.is(r,Q)?[0][P](r):arguments;return t&&e.is(t,Z)&&i.length-1&&(t=t.replace(C,function(t,e){return null==i[++e]?R:i[e]})),t||R},e.fullfill=function(){var t=/\{([^\}]+)\}/g,e=/(?:(?:^|\.)(.+?)(?=\[|\.|$|\()|\[('|")(.+?)\2\])(\(\))?/g,r=function(t,r,i){var n=i;return r.replace(e,function(t,e,r,i,a){e=e||i,n&&(e in n&&(n=n[e]),"function"==typeof n&&a&&(n=n()))}),n=(null==n||n==i?t:n)+""};return function(e,i){return String(e).replace(t,function(t,e){return r(t,e,i)})}}(),e.ninja=function(){if(E.was)A.win.Raphael=E.is;else{window.Raphael=void 0;try{delete window.Raphael}catch(t){}}return e},e.st=Pe,t.on("raphael.DOMload",function(){w=!0}),function(t,r,i){function n(){/in/.test(t.readyState)?setTimeout(n,9):e.eve("raphael.DOMload")}null==t.readyState&&t.addEventListener&&(t.addEventListener(r,i=function(){t.removeEventListener(r,i,!1),t.readyState="complete"},!1),t.readyState="loading"),n()}(document,"DOMContentLoaded"),e}.apply(e,i),!(void 0!==n&&(t.exports=n))},function(t,e,r){var i,n;!function(r){var a="0.4.2",s="hasOwnProperty",o=/[\.\/]/,l="*",h=function(){},u=function(t,e){return t-e},c,f,p={n:{}},d=function(t,e){t=String(t);var r=p,i=f,n=Array.prototype.slice.call(arguments,2),a=d.listeners(t),s=0,o=!1,l,h=[],g={},x=[],v=c,y=[];c=t,f=0;for(var m=0,b=a.length;b>m;m++)"zIndex"in a[m]&&(h.push(a[m].zIndex),a[m].zIndex<0&&(g[a[m].zIndex]=a[m]));for(h.sort(u);h[s]<0;)if(l=g[h[s++]],x.push(l.apply(e,n)),f)return f=i,x;for(m=0;b>m;m++)if(l=a[m],"zIndex"in l)if(l.zIndex==h[s]){if(x.push(l.apply(e,n)),f)break;do if(s++,l=g[h[s]],l&&x.push(l.apply(e,n)),f)break;while(l)}else g[l.zIndex]=l;else if(x.push(l.apply(e,n)),f)break;return f=i,c=v,x.length?x:null};d._events=p,d.listeners=function(t){var e=t.split(o),r=p,i,n,a,s,h,u,c,f,d=[r],g=[];for(s=0,h=e.length;h>s;s++){for(f=[],u=0,c=d.length;c>u;u++)for(r=d[u].n,n=[r[e[s]],r[l]],a=2;a--;)i=n[a],i&&(f.push(i),g=g.concat(i.f||[]));d=f}return g},d.on=function(t,e){if(t=String(t),"function"!=typeof e)return function(){};for(var r=t.split(o),i=p,n=0,a=r.length;a>n;n++)i=i.n,i=i.hasOwnProperty(r[n])&&i[r[n]]||(i[r[n]]={n:{}});for(i.f=i.f||[],n=0,a=i.f.length;a>n;n++)if(i.f[n]==e)return h;return i.f.push(e),function(t){+t==+t&&(e.zIndex=+t)}},d.f=function(t){var e=[].slice.call(arguments,1);return function(){d.apply(null,[t,null].concat(e).concat([].slice.call(arguments,0)))}},d.stop=function(){f=1},d.nt=function(t){return t?new RegExp("(?:\\.|\\/|^)"+t+"(?:\\.|\\/|$)").test(c):c},d.nts=function(){return c.split(o)},d.off=d.unbind=function(t,e){if(!t)return void(d._events=p={n:{}});var r=t.split(o),i,n,a,h,u,c,f,g=[p];for(h=0,u=r.length;u>h;h++)for(c=0;c<g.length;c+=a.length-2){if(a=[c,1],i=g[c].n,r[h]!=l)i[r[h]]&&a.push(i[r[h]]);else for(n in i)i[s](n)&&a.push(i[n]);g.splice.apply(g,a)}for(h=0,u=g.length;u>h;h++)for(i=g[h];i.n;){if(e){if(i.f){for(c=0,f=i.f.length;f>c;c++)if(i.f[c]==e){i.f.splice(c,1);break}!i.f.length&&delete i.f}for(n in i.n)if(i.n[s](n)&&i.n[n].f){var x=i.n[n].f;for(c=0,f=x.length;f>c;c++)if(x[c]==e){x.splice(c,1);break}!x.length&&delete i.n[n].f}}else{delete i.f;for(n in i.n)i.n[s](n)&&i.n[n].f&&delete i.n[n].f}i=i.n}},d.once=function(t,e){var r=function(){return d.unbind(t,r),e.apply(this,arguments)};return d.on(t,r)},d.version=a,d.toString=function(){return"You are running Eve "+a},"undefined"!=typeof t&&t.exports?t.exports=d:(i=[],n=function(){return d}.apply(e,i),!(void 0!==n&&(t.exports=n)))}(this)},function(t,e,r){var i,n;i=[r(1)],n=function(t){if(!t||t.svg){var e="hasOwnProperty",r=String,i=parseFloat,n=parseInt,a=Math,s=a.max,o=a.abs,l=a.pow,h=/[, ]+/,u=t.eve,c="",f=" ",p="http://www.w3.org/1999/xlink",d={block:"M5,0 0,2.5 5,5z",classic:"M5,0 0,2.5 5,5 3.5,3 3.5,2z",diamond:"M2.5,0 5,2.5 2.5,5 0,2.5z",open:"M6,1 1,3.5 6,6",oval:"M2.5,0A2.5,2.5,0,0,1,2.5,5 2.5,2.5,0,0,1,2.5,0z"},g={};t.toString=function(){return"Your browser supports SVG.\nYou are running Raphaël "+this.version};var x=function(i,n){if(n){"string"==typeof i&&(i=x(i));for(var a in n)n[e](a)&&("xlink:"==a.substring(0,6)?i.setAttributeNS(p,a.substring(6),r(n[a])):i.setAttribute(a,r(n[a])))}else i=t._g.doc.createElementNS("http://www.w3.org/2000/svg",i),i.style&&(i.style.webkitTapHighlightColor="rgba(0,0,0,0)");return i},v=function(e,n){var h="linear",u=e.id+n,f=.5,p=.5,d=e.node,g=e.paper,v=d.style,y=t._g.doc.getElementById(u);if(!y){if(n=r(n).replace(t._radial_gradient,function(t,e,r){if(h="radial",e&&r){f=i(e),p=i(r);var n=2*(p>.5)-1;l(f-.5,2)+l(p-.5,2)>.25&&(p=a.sqrt(.25-l(f-.5,2))*n+.5)&&.5!=p&&(p=p.toFixed(5)-1e-5*n)}return c}),n=n.split(/\s*\-\s*/),"linear"==h){var b=n.shift();if(b=-i(b),isNaN(b))return null;var _=[0,0,a.cos(t.rad(b)),a.sin(t.rad(b))],w=1/(s(o(_[2]),o(_[3]))||1);_[2]*=w,_[3]*=w,_[2]<0&&(_[0]=-_[2],_[2]=0),_[3]<0&&(_[1]=-_[3],_[3]=0)}var k=t._parseDots(n);if(!k)return null;if(u=u.replace(/[\(\)\s,\xb0#]/g,"_"),e.gradient&&u!=e.gradient.id&&(g.defs.removeChild(e.gradient),delete e.gradient),!e.gradient){y=x(h+"Gradient",{id:u}),e.gradient=y,x(y,"radial"==h?{fx:f,fy:p}:{x1:_[0],y1:_[1],x2:_[2],y2:_[3],gradientTransform:e.matrix.invert()}),g.defs.appendChild(y);for(var B=0,C=k.length;C>B;B++)y.appendChild(x("stop",{offset:k[B].offset?k[B].offset:B?"100%":"0%","stop-color":k[B].color||"#fff","stop-opacity":isFinite(k[B].opacity)?k[B].opacity:1}))}}return x(d,{fill:m(u),opacity:1,"fill-opacity":1}),v.fill=c,v.opacity=1,v.fillOpacity=1,1},y=function(){var t=document.documentMode;return t&&(9===t||10===t)},m=function(t){if(y())return"url('#"+t+"')";var e=document.location,r=e.protocol+"//"+e.host+e.pathname+e.search;return"url('"+r+"#"+t+"')"},b=function(t){var e=t.getBBox(1);x(t.pattern,{patternTransform:t.matrix.invert()+" translate("+e.x+","+e.y+")"})},_=function(i,n,a){if("path"==i.type){for(var s=r(n).toLowerCase().split("-"),o=i.paper,l=a?"end":"start",h=i.node,u=i.attrs,f=u["stroke-width"],p=s.length,v="classic",y,m,b,_,w,k=3,B=3,C=5;p--;)switch(s[p]){case"block":case"classic":case"oval":case"diamond":case"open":case"none":v=s[p];break;case"wide":B=5;break;case"narrow":B=2;break;case"long":k=5;break;case"short":k=2}if("open"==v?(k+=2,B+=2,C+=2,b=1,_=a?4:1,w={fill:"none",stroke:u.stroke}):(_=b=k/2,w={fill:u.stroke,stroke:"none"}),i._.arrows?a?(i._.arrows.endPath&&g[i._.arrows.endPath]--,i._.arrows.endMarker&&g[i._.arrows.endMarker]--):(i._.arrows.startPath&&g[i._.arrows.startPath]--,i._.arrows.startMarker&&g[i._.arrows.startMarker]--):i._.arrows={},"none"!=v){var S="raphael-marker-"+v,T="raphael-marker-"+l+v+k+B+"-obj"+i.id;t._g.doc.getElementById(S)?g[S]++:(o.defs.appendChild(x(x("path"),{"stroke-linecap":"round",d:d[v],id:S})),g[S]=1);var A=t._g.doc.getElementById(T),E;A?(g[T]++,E=A.getElementsByTagName("use")[0]):(A=x(x("marker"),{id:T,markerHeight:B,markerWidth:k,orient:"auto",refX:_,refY:B/2}),E=x(x("use"),{"xlink:href":"#"+S,transform:(a?"rotate(180 "+k/2+" "+B/2+") ":c)+"scale("+k/C+","+B/C+")","stroke-width":(1/((k/C+B/C)/2)).toFixed(4)}),A.appendChild(E),o.defs.appendChild(A),g[T]=1),x(E,w);var N=b*("diamond"!=v&&"oval"!=v);a?(y=i._.arrows.startdx*f||0,m=t.getTotalLength(u.path)-N*f):(y=N*f,m=t.getTotalLength(u.path)-(i._.arrows.enddx*f||0)),w={},w["marker-"+l]="url(#"+T+")",(m||y)&&(w.d=t.getSubpath(u.path,y,m)),x(h,w),i._.arrows[l+"Path"]=S,i._.arrows[l+"Marker"]=T,i._.arrows[l+"dx"]=N,i._.arrows[l+"Type"]=v,i._.arrows[l+"String"]=n}else a?(y=i._.arrows.startdx*f||0,m=t.getTotalLength(u.path)-y):(y=0,m=t.getTotalLength(u.path)-(i._.arrows.enddx*f||0)),i._.arrows[l+"Path"]&&x(h,{d:t.getSubpath(u.path,y,m)}),delete i._.arrows[l+"Path"],delete i._.arrows[l+"Marker"],delete i._.arrows[l+"dx"],delete i._.arrows[l+"Type"],delete i._.arrows[l+"String"];for(w in g)if(g[e](w)&&!g[w]){var M=t._g.doc.getElementById(w);M&&M.parentNode.removeChild(M)}}},w={"-":[3,1],".":[1,1],"-.":[3,1,1,1],"-..":[3,1,1,1,1,1],". ":[1,3],"- ":[4,3],"--":[8,3],"- .":[4,3,1,3],"--.":[8,3,1,3],"--..":[8,3,1,3,1,3]},k=function(t,e,i){if(e=w[r(e).toLowerCase()]){for(var n=t.attrs["stroke-width"]||"1",a={round:n,square:n,butt:0}[t.attrs["stroke-linecap"]||i["stroke-linecap"]]||0,s=[],o=e.length;o--;)s[o]=e[o]*n+(o%2?1:-1)*a;x(t.node,{"stroke-dasharray":s.join(",")})}else x(t.node,{"stroke-dasharray":"none"})},B=function(i,a){var l=i.node,u=i.attrs,f=l.style.visibility;l.style.visibility="hidden";for(var d in a)if(a[e](d)){if(!t._availableAttrs[e](d))continue;var g=a[d];switch(u[d]=g,d){case"blur":i.blur(g);break;case"title":var y=l.getElementsByTagName("title");if(y.length&&(y=y[0]))y.firstChild.nodeValue=g;else{y=x("title");var m=t._g.doc.createTextNode(g);y.appendChild(m),l.appendChild(y)}break;case"href":case"target":var w=l.parentNode;if("a"!=w.tagName.toLowerCase()){var B=x("a");w.insertBefore(B,l),B.appendChild(l),w=B}"target"==d?w.setAttributeNS(p,"show","blank"==g?"new":g):w.setAttributeNS(p,d,g);break;case"cursor":l.style.cursor=g;break;case"transform":i.transform(g);break;case"arrow-start":_(i,g);break;case"arrow-end":_(i,g,1);break;case"clip-rect":var C=r(g).split(h);if(4==C.length){i.clip&&i.clip.parentNode.parentNode.removeChild(i.clip.parentNode);var T=x("clipPath"),A=x("rect");T.id=t.createUUID(),x(A,{x:C[0],y:C[1],width:C[2],height:C[3]}),T.appendChild(A),i.paper.defs.appendChild(T),x(l,{"clip-path":"url(#"+T.id+")"}),i.clip=A}if(!g){var E=l.getAttribute("clip-path");if(E){var N=t._g.doc.getElementById(E.replace(/(^url\(#|\)$)/g,c));N&&N.parentNode.removeChild(N),x(l,{"clip-path":c}),delete i.clip}}break;case"path":"path"==i.type&&(x(l,{d:g?u.path=t._pathToAbsolute(g):"M0,0"}),i._.dirty=1,i._.arrows&&("startString"in i._.arrows&&_(i,i._.arrows.startString),"endString"in i._.arrows&&_(i,i._.arrows.endString,1)));break;case"width":if(l.setAttribute(d,g),i._.dirty=1,!u.fx)break;d="x",g=u.x;case"x":u.fx&&(g=-u.x-(u.width||0));case"rx":if("rx"==d&&"rect"==i.type)break;case"cx":l.setAttribute(d,g),i.pattern&&b(i),i._.dirty=1;break;case"height":if(l.setAttribute(d,g),i._.dirty=1,!u.fy)break;d="y",g=u.y;case"y":u.fy&&(g=-u.y-(u.height||0));case"ry":if("ry"==d&&"rect"==i.type)break;case"cy":l.setAttribute(d,g),i.pattern&&b(i),i._.dirty=1;break;case"r":"rect"==i.type?x(l,{rx:g,ry:g}):l.setAttribute(d,g),i._.dirty=1;break;case"src":"image"==i.type&&l.setAttributeNS(p,"href",g);break;case"stroke-width":1==i._.sx&&1==i._.sy||(g/=s(o(i._.sx),o(i._.sy))||1),l.setAttribute(d,g),u["stroke-dasharray"]&&k(i,u["stroke-dasharray"],a),i._.arrows&&("startString"in i._.arrows&&_(i,i._.arrows.startString),"endString"in i._.arrows&&_(i,i._.arrows.endString,1));break;case"stroke-dasharray":k(i,g,a);break;case"fill":var M=r(g).match(t._ISURL);if(M){T=x("pattern");var L=x("image");T.id=t.createUUID(),x(T,{x:0,y:0,patternUnits:"userSpaceOnUse",height:1,width:1}),x(L,{x:0,y:0,"xlink:href":M[1]}),T.appendChild(L),function(e){t._preload(M[1],function(){var t=this.offsetWidth,r=this.offsetHeight;x(e,{width:t,height:r}),x(L,{width:t,height:r})})}(T),i.paper.defs.appendChild(T),x(l,{fill:"url(#"+T.id+")"}),i.pattern=T,i.pattern&&b(i);break}var z=t.getRGB(g);if(z.error){if(("circle"==i.type||"ellipse"==i.type||"r"!=r(g).charAt())&&v(i,g)){
if("opacity"in u||"fill-opacity"in u){var P=t._g.doc.getElementById(l.getAttribute("fill").replace(/^url\(#|\)$/g,c));if(P){var F=P.getElementsByTagName("stop");x(F[F.length-1],{"stop-opacity":("opacity"in u?u.opacity:1)*("fill-opacity"in u?u["fill-opacity"]:1)})}}u.gradient=g,u.fill="none";break}}else delete a.gradient,delete u.gradient,!t.is(u.opacity,"undefined")&&t.is(a.opacity,"undefined")&&x(l,{opacity:u.opacity}),!t.is(u["fill-opacity"],"undefined")&&t.is(a["fill-opacity"],"undefined")&&x(l,{"fill-opacity":u["fill-opacity"]});z[e]("opacity")&&x(l,{"fill-opacity":z.opacity>1?z.opacity/100:z.opacity});case"stroke":z=t.getRGB(g),l.setAttribute(d,z.hex),"stroke"==d&&z[e]("opacity")&&x(l,{"stroke-opacity":z.opacity>1?z.opacity/100:z.opacity}),"stroke"==d&&i._.arrows&&("startString"in i._.arrows&&_(i,i._.arrows.startString),"endString"in i._.arrows&&_(i,i._.arrows.endString,1));break;case"gradient":("circle"==i.type||"ellipse"==i.type||"r"!=r(g).charAt())&&v(i,g);break;case"opacity":u.gradient&&!u[e]("stroke-opacity")&&x(l,{"stroke-opacity":g>1?g/100:g});case"fill-opacity":if(u.gradient){P=t._g.doc.getElementById(l.getAttribute("fill").replace(/^url\(#|\)$/g,c)),P&&(F=P.getElementsByTagName("stop"),x(F[F.length-1],{"stop-opacity":g}));break}default:"font-size"==d&&(g=n(g,10)+"px");var R=d.replace(/(\-.)/g,function(t){return t.substring(1).toUpperCase()});l.style[R]=g,i._.dirty=1,l.setAttribute(d,g)}}S(i,a),l.style.visibility=f},C=1.2,S=function(i,a){if("text"==i.type&&(a[e]("text")||a[e]("font")||a[e]("font-size")||a[e]("x")||a[e]("y"))){var s=i.attrs,o=i.node,l=o.firstChild?n(t._g.doc.defaultView.getComputedStyle(o.firstChild,c).getPropertyValue("font-size"),10):10;if(a[e]("text")){for(s.text=a.text;o.firstChild;)o.removeChild(o.firstChild);for(var h=r(a.text).split("\n"),u=[],f,p=0,d=h.length;d>p;p++)f=x("tspan"),p&&x(f,{dy:l*C,x:s.x}),f.appendChild(t._g.doc.createTextNode(h[p])),o.appendChild(f),u[p]=f}else for(u=o.getElementsByTagName("tspan"),p=0,d=u.length;d>p;p++)p?x(u[p],{dy:l*C,x:s.x}):x(u[0],{dy:0});x(o,{x:s.x,y:s.y}),i._.dirty=1;var g=i._getBBox(),v=s.y-(g.y+g.height/2);v&&t.is(v,"finite")&&x(u[0],{dy:v})}},T=function(t){return t.parentNode&&"a"===t.parentNode.tagName.toLowerCase()?t.parentNode:t},A=function(e,r){var i=0,n=0;this[0]=this.node=e,e.raphael=!0,this.id=t._oid++,e.raphaelid=this.id,this.matrix=t.matrix(),this.realPath=null,this.paper=r,this.attrs=this.attrs||{},this._={transform:[],sx:1,sy:1,deg:0,dx:0,dy:0,dirty:1},!r.bottom&&(r.bottom=this),this.prev=r.top,r.top&&(r.top.next=this),r.top=this,this.next=null},E=t.el;A.prototype=E,E.constructor=A,t._engine.path=function(t,e){var r=x("path");e.canvas&&e.canvas.appendChild(r);var i=new A(r,e);return i.type="path",B(i,{fill:"none",stroke:"#000",path:t}),i},E.rotate=function(t,e,n){if(this.removed)return this;if(t=r(t).split(h),t.length-1&&(e=i(t[1]),n=i(t[2])),t=i(t[0]),null==n&&(e=n),null==e||null==n){var a=this.getBBox(1);e=a.x+a.width/2,n=a.y+a.height/2}return this.transform(this._.transform.concat([["r",t,e,n]])),this},E.scale=function(t,e,n,a){if(this.removed)return this;if(t=r(t).split(h),t.length-1&&(e=i(t[1]),n=i(t[2]),a=i(t[3])),t=i(t[0]),null==e&&(e=t),null==a&&(n=a),null==n||null==a)var s=this.getBBox(1);return n=null==n?s.x+s.width/2:n,a=null==a?s.y+s.height/2:a,this.transform(this._.transform.concat([["s",t,e,n,a]])),this},E.translate=function(t,e){return this.removed?this:(t=r(t).split(h),t.length-1&&(e=i(t[1])),t=i(t[0])||0,e=+e||0,this.transform(this._.transform.concat([["t",t,e]])),this)},E.transform=function(r){var i=this._;if(null==r)return i.transform;if(t._extractTransform(this,r),this.clip&&x(this.clip,{transform:this.matrix.invert()}),this.pattern&&b(this),this.node&&x(this.node,{transform:this.matrix}),1!=i.sx||1!=i.sy){var n=this.attrs[e]("stroke-width")?this.attrs["stroke-width"]:1;this.attr({"stroke-width":n})}return i.transform=this.matrix.toTransformString(),this},E.hide=function(){return this.removed||(this.node.style.display="none"),this},E.show=function(){return this.removed||(this.node.style.display=""),this},E.remove=function(){var e=T(this.node);if(!this.removed&&e.parentNode){var r=this.paper;r.__set__&&r.__set__.exclude(this),u.unbind("raphael.*.*."+this.id),this.gradient&&r.defs.removeChild(this.gradient),t._tear(this,r),e.parentNode.removeChild(e),this.removeData();for(var i in this)this[i]="function"==typeof this[i]?t._removedFactory(i):null;this.removed=!0}},E._getBBox=function(){if("none"==this.node.style.display){this.show();var t=!0}var e=!1,r;this.paper.canvas.parentElement?r=this.paper.canvas.parentElement.style:this.paper.canvas.parentNode&&(r=this.paper.canvas.parentNode.style),r&&"none"==r.display&&(e=!0,r.display="");var i={};try{i=this.node.getBBox()}catch(n){i={x:this.node.clientLeft,y:this.node.clientTop,width:this.node.clientWidth,height:this.node.clientHeight}}finally{i=i||{},e&&(r.display="none")}return t&&this.hide(),i},E.attr=function(r,i){if(this.removed)return this;if(null==r){var n={};for(var a in this.attrs)this.attrs[e](a)&&(n[a]=this.attrs[a]);return n.gradient&&"none"==n.fill&&(n.fill=n.gradient)&&delete n.gradient,n.transform=this._.transform,n}if(null==i&&t.is(r,"string")){if("fill"==r&&"none"==this.attrs.fill&&this.attrs.gradient)return this.attrs.gradient;if("transform"==r)return this._.transform;for(var s=r.split(h),o={},l=0,c=s.length;c>l;l++)r=s[l],r in this.attrs?o[r]=this.attrs[r]:t.is(this.paper.customAttributes[r],"function")?o[r]=this.paper.customAttributes[r].def:o[r]=t._availableAttrs[r];return c-1?o:o[s[0]]}if(null==i&&t.is(r,"array")){for(o={},l=0,c=r.length;c>l;l++)o[r[l]]=this.attr(r[l]);return o}if(null!=i){var f={};f[r]=i}else null!=r&&t.is(r,"object")&&(f=r);for(var p in f)u("raphael.attr."+p+"."+this.id,this,f[p]);for(p in this.paper.customAttributes)if(this.paper.customAttributes[e](p)&&f[e](p)&&t.is(this.paper.customAttributes[p],"function")){var d=this.paper.customAttributes[p].apply(this,[].concat(f[p]));this.attrs[p]=f[p];for(var g in d)d[e](g)&&(f[g]=d[g])}return B(this,f),this},E.toFront=function(){if(this.removed)return this;var e=T(this.node);e.parentNode.appendChild(e);var r=this.paper;return r.top!=this&&t._tofront(this,r),this},E.toBack=function(){if(this.removed)return this;var e=T(this.node),r=e.parentNode;r.insertBefore(e,r.firstChild),t._toback(this,this.paper);var i=this.paper;return this},E.insertAfter=function(e){if(this.removed||!e)return this;var r=T(this.node),i=T(e.node||e[e.length-1].node);return i.nextSibling?i.parentNode.insertBefore(r,i.nextSibling):i.parentNode.appendChild(r),t._insertafter(this,e,this.paper),this},E.insertBefore=function(e){if(this.removed||!e)return this;var r=T(this.node),i=T(e.node||e[0].node);return i.parentNode.insertBefore(r,i),t._insertbefore(this,e,this.paper),this},E.blur=function(e){var r=this;if(0!==+e){var i=x("filter"),n=x("feGaussianBlur");r.attrs.blur=e,i.id=t.createUUID(),x(n,{stdDeviation:+e||1.5}),i.appendChild(n),r.paper.defs.appendChild(i),r._blur=i,x(r.node,{filter:"url(#"+i.id+")"})}else r._blur&&(r._blur.parentNode.removeChild(r._blur),delete r._blur,delete r.attrs.blur),r.node.removeAttribute("filter");return r},t._engine.circle=function(t,e,r,i){var n=x("circle");t.canvas&&t.canvas.appendChild(n);var a=new A(n,t);return a.attrs={cx:e,cy:r,r:i,fill:"none",stroke:"#000"},a.type="circle",x(n,a.attrs),a},t._engine.rect=function(t,e,r,i,n,a){var s=x("rect");t.canvas&&t.canvas.appendChild(s);var o=new A(s,t);return o.attrs={x:e,y:r,width:i,height:n,rx:a||0,ry:a||0,fill:"none",stroke:"#000"},o.type="rect",x(s,o.attrs),o},t._engine.ellipse=function(t,e,r,i,n){var a=x("ellipse");t.canvas&&t.canvas.appendChild(a);var s=new A(a,t);return s.attrs={cx:e,cy:r,rx:i,ry:n,fill:"none",stroke:"#000"},s.type="ellipse",x(a,s.attrs),s},t._engine.image=function(t,e,r,i,n,a){var s=x("image");x(s,{x:r,y:i,width:n,height:a,preserveAspectRatio:"none"}),s.setAttributeNS(p,"href",e),t.canvas&&t.canvas.appendChild(s);var o=new A(s,t);return o.attrs={x:r,y:i,width:n,height:a,src:e},o.type="image",o},t._engine.text=function(e,r,i,n){var a=x("text");e.canvas&&e.canvas.appendChild(a);var s=new A(a,e);return s.attrs={x:r,y:i,"text-anchor":"middle",text:n,"font-family":t._availableAttrs["font-family"],"font-size":t._availableAttrs["font-size"],stroke:"none",fill:"#000"},s.type="text",B(s,s.attrs),s},t._engine.setSize=function(t,e){return this.width=t||this.width,this.height=e||this.height,this.canvas.setAttribute("width",this.width),this.canvas.setAttribute("height",this.height),this._viewBox&&this.setViewBox.apply(this,this._viewBox),this},t._engine.create=function(){var e=t._getContainer.apply(0,arguments),r=e&&e.container,i=e.x,n=e.y,a=e.width,s=e.height;if(!r)throw new Error("SVG container not found.");var o=x("svg"),l="overflow:hidden;",h;return i=i||0,n=n||0,a=a||512,s=s||342,x(o,{height:s,version:1.1,width:a,xmlns:"http://www.w3.org/2000/svg","xmlns:xlink":"http://www.w3.org/1999/xlink"}),1==r?(o.style.cssText=l+"position:absolute;left:"+i+"px;top:"+n+"px",t._g.doc.body.appendChild(o),h=1):(o.style.cssText=l+"position:relative",r.firstChild?r.insertBefore(o,r.firstChild):r.appendChild(o)),r=new t._Paper,r.width=a,r.height=s,r.canvas=o,r.clear(),r._left=r._top=0,h&&(r.renderfix=function(){}),r.renderfix(),r},t._engine.setViewBox=function(t,e,r,i,n){u("raphael.setViewBox",this,this._viewBox,[t,e,r,i,n]);var a=this.getSize(),o=s(r/a.width,i/a.height),l=this.top,h=n?"xMidYMid meet":"xMinYMin",c,p;for(null==t?(this._vbSize&&(o=1),delete this._vbSize,c="0 0 "+this.width+f+this.height):(this._vbSize=o,c=t+f+e+f+r+f+i),x(this.canvas,{viewBox:c,preserveAspectRatio:h});o&&l;)p="stroke-width"in l.attrs?l.attrs["stroke-width"]:1,l.attr({"stroke-width":p}),l._.dirty=1,l._.dirtyT=1,l=l.prev;return this._viewBox=[t,e,r,i,!!n],this},t.prototype.renderfix=function(){var t=this.canvas,e=t.style,r;try{r=t.getScreenCTM()||t.createSVGMatrix()}catch(i){r=t.createSVGMatrix()}var n=-r.e%1,a=-r.f%1;(n||a)&&(n&&(this._left=(this._left+n)%1,e.left=this._left+"px"),a&&(this._top=(this._top+a)%1,e.top=this._top+"px"))},t.prototype.clear=function(){t.eve("raphael.clear",this);for(var e=this.canvas;e.firstChild;)e.removeChild(e.firstChild);this.bottom=this.top=null,(this.desc=x("desc")).appendChild(t._g.doc.createTextNode("Created with Raphaël "+t.version)),e.appendChild(this.desc),e.appendChild(this.defs=x("defs"))},t.prototype.remove=function(){u("raphael.remove",this),this.canvas.parentNode&&this.canvas.parentNode.removeChild(this.canvas);for(var e in this)this[e]="function"==typeof this[e]?t._removedFactory(e):null};var N=t.st;for(var M in E)E[e](M)&&!N[e](M)&&(N[M]=function(t){return function(){var e=arguments;return this.forEach(function(r){r[t].apply(r,e)})}}(M))}}.apply(e,i),!(void 0!==n&&(t.exports=n))},function(t,e,r){var i,n;i=[r(1)],n=function(t){if(!t||t.vml){var e="hasOwnProperty",r=String,i=parseFloat,n=Math,a=n.round,s=n.max,o=n.min,l=n.abs,h="fill",u=/[, ]+/,c=t.eve,f=" progid:DXImageTransform.Microsoft",p=" ",d="",g={M:"m",L:"l",C:"c",Z:"x",m:"t",l:"r",c:"v",z:"x"},x=/([clmz]),?([^clmz]*)/gi,v=/ progid:\S+Blur\([^\)]+\)/g,y=/-?[^,\s-]+/g,m="position:absolute;left:0;top:0;width:1px;height:1px;behavior:url(#default#VML)",b=21600,_={path:1,rect:1,image:1},w={circle:1,ellipse:1},k=function(e){var i=/[ahqstv]/gi,n=t._pathToAbsolute;if(r(e).match(i)&&(n=t._path2curve),i=/[clmz]/g,n==t._pathToAbsolute&&!r(e).match(i)){var s=r(e).replace(x,function(t,e,r){var i=[],n="m"==e.toLowerCase(),s=g[e];return r.replace(y,function(t){n&&2==i.length&&(s+=i+g["m"==e?"l":"L"],i=[]),i.push(a(t*b))}),s+i});return s}var o=n(e),l,h;s=[];for(var u=0,c=o.length;c>u;u++){l=o[u],h=o[u][0].toLowerCase(),"z"==h&&(h="x");for(var f=1,v=l.length;v>f;f++)h+=a(l[f]*b)+(f!=v-1?",":d);s.push(h)}return s.join(p)},B=function(e,r,i){var n=t.matrix();return n.rotate(-e,.5,.5),{dx:n.x(r,i),dy:n.y(r,i)}},C=function(t,e,r,i,n,a){var s=t._,o=t.matrix,u=s.fillpos,c=t.node,f=c.style,d=1,g="",x,v=b/e,y=b/r;if(f.visibility="hidden",e&&r){if(c.coordsize=l(v)+p+l(y),f.rotation=a*(0>e*r?-1:1),a){var m=B(a,i,n);i=m.dx,n=m.dy}if(0>e&&(g+="x"),0>r&&(g+=" y")&&(d=-1),f.flip=g,c.coordorigin=i*-v+p+n*-y,u||s.fillsize){var _=c.getElementsByTagName(h);_=_&&_[0],c.removeChild(_),u&&(m=B(a,o.x(u[0],u[1]),o.y(u[0],u[1])),_.position=m.dx*d+p+m.dy*d),s.fillsize&&(_.size=s.fillsize[0]*l(e)+p+s.fillsize[1]*l(r)),c.appendChild(_)}f.visibility="visible"}};t.toString=function(){return"Your browser doesn’t support SVG. Falling down to VML.\nYou are running Raphaël "+this.version};var S=function(t,e,i){for(var n=r(e).toLowerCase().split("-"),a=i?"end":"start",s=n.length,o="classic",l="medium",h="medium";s--;)switch(n[s]){case"block":case"classic":case"oval":case"diamond":case"open":case"none":o=n[s];break;case"wide":case"narrow":h=n[s];break;case"long":case"short":l=n[s]}var u=t.node.getElementsByTagName("stroke")[0];u[a+"arrow"]=o,u[a+"arrowlength"]=l,u[a+"arrowwidth"]=h},T=function(n,l){n.attrs=n.attrs||{};var c=n.node,f=n.attrs,g=c.style,x,v=_[n.type]&&(l.x!=f.x||l.y!=f.y||l.width!=f.width||l.height!=f.height||l.cx!=f.cx||l.cy!=f.cy||l.rx!=f.rx||l.ry!=f.ry||l.r!=f.r),y=w[n.type]&&(f.cx!=l.cx||f.cy!=l.cy||f.r!=l.r||f.rx!=l.rx||f.ry!=l.ry),m=n;for(var B in l)l[e](B)&&(f[B]=l[B]);if(v&&(f.path=t._getPath[n.type](n),n._.dirty=1),l.href&&(c.href=l.href),l.title&&(c.title=l.title),l.target&&(c.target=l.target),l.cursor&&(g.cursor=l.cursor),"blur"in l&&n.blur(l.blur),(l.path&&"path"==n.type||v)&&(c.path=k(~r(f.path).toLowerCase().indexOf("r")?t._pathToAbsolute(f.path):f.path),n._.dirty=1,"image"==n.type&&(n._.fillpos=[f.x,f.y],n._.fillsize=[f.width,f.height],C(n,1,1,0,0,0))),"transform"in l&&n.transform(l.transform),y){var T=+f.cx,E=+f.cy,N=+f.rx||+f.r||0,L=+f.ry||+f.r||0;c.path=t.format("ar{0},{1},{2},{3},{4},{1},{4},{1}x",a((T-N)*b),a((E-L)*b),a((T+N)*b),a((E+L)*b),a(T*b)),n._.dirty=1}if("clip-rect"in l){var z=r(l["clip-rect"]).split(u);if(4==z.length){z[2]=+z[2]+ +z[0],z[3]=+z[3]+ +z[1];var P=c.clipRect||t._g.doc.createElement("div"),F=P.style;F.clip=t.format("rect({1}px {2}px {3}px {0}px)",z),c.clipRect||(F.position="absolute",F.top=0,F.left=0,F.width=n.paper.width+"px",F.height=n.paper.height+"px",c.parentNode.insertBefore(P,c),P.appendChild(c),c.clipRect=P)}l["clip-rect"]||c.clipRect&&(c.clipRect.style.clip="auto")}if(n.textpath){var R=n.textpath.style;l.font&&(R.font=l.font),l["font-family"]&&(R.fontFamily='"'+l["font-family"].split(",")[0].replace(/^['"]+|['"]+$/g,d)+'"'),l["font-size"]&&(R.fontSize=l["font-size"]),l["font-weight"]&&(R.fontWeight=l["font-weight"]),l["font-style"]&&(R.fontStyle=l["font-style"])}if("arrow-start"in l&&S(m,l["arrow-start"]),"arrow-end"in l&&S(m,l["arrow-end"],1),null!=l.opacity||null!=l.fill||null!=l.src||null!=l.stroke||null!=l["stroke-width"]||null!=l["stroke-opacity"]||null!=l["fill-opacity"]||null!=l["stroke-dasharray"]||null!=l["stroke-miterlimit"]||null!=l["stroke-linejoin"]||null!=l["stroke-linecap"]){var I=c.getElementsByTagName(h),j=!1;if(I=I&&I[0],!I&&(j=I=M(h)),"image"==n.type&&l.src&&(I.src=l.src),l.fill&&(I.on=!0),null!=I.on&&"none"!=l.fill&&null!==l.fill||(I.on=!1),I.on&&l.fill){var q=r(l.fill).match(t._ISURL);if(q){I.parentNode==c&&c.removeChild(I),I.rotate=!0,I.src=q[1],I.type="tile";var D=n.getBBox(1);I.position=D.x+p+D.y,n._.fillpos=[D.x,D.y],t._preload(q[1],function(){n._.fillsize=[this.offsetWidth,this.offsetHeight]})}else I.color=t.getRGB(l.fill).hex,I.src=d,I.type="solid",t.getRGB(l.fill).error&&(m.type in{circle:1,ellipse:1}||"r"!=r(l.fill).charAt())&&A(m,l.fill,I)&&(f.fill="none",f.gradient=l.fill,I.rotate=!1)}if("fill-opacity"in l||"opacity"in l){var V=((+f["fill-opacity"]+1||2)-1)*((+f.opacity+1||2)-1)*((+t.getRGB(l.fill).o+1||2)-1);V=o(s(V,0),1),I.opacity=V,I.src&&(I.color="none")}c.appendChild(I);var O=c.getElementsByTagName("stroke")&&c.getElementsByTagName("stroke")[0],Y=!1;!O&&(Y=O=M("stroke")),(l.stroke&&"none"!=l.stroke||l["stroke-width"]||null!=l["stroke-opacity"]||l["stroke-dasharray"]||l["stroke-miterlimit"]||l["stroke-linejoin"]||l["stroke-linecap"])&&(O.on=!0),("none"==l.stroke||null===l.stroke||null==O.on||0==l.stroke||0==l["stroke-width"])&&(O.on=!1);var W=t.getRGB(l.stroke);O.on&&l.stroke&&(O.color=W.hex),V=((+f["stroke-opacity"]+1||2)-1)*((+f.opacity+1||2)-1)*((+W.o+1||2)-1);var G=.75*(i(l["stroke-width"])||1);if(V=o(s(V,0),1),null==l["stroke-width"]&&(G=f["stroke-width"]),l["stroke-width"]&&(O.weight=G),G&&1>G&&(V*=G)&&(O.weight=1),O.opacity=V,l["stroke-linejoin"]&&(O.joinstyle=l["stroke-linejoin"]||"miter"),O.miterlimit=l["stroke-miterlimit"]||8,l["stroke-linecap"]&&(O.endcap="butt"==l["stroke-linecap"]?"flat":"square"==l["stroke-linecap"]?"square":"round"),"stroke-dasharray"in l){var H={"-":"shortdash",".":"shortdot","-.":"shortdashdot","-..":"shortdashdotdot",". ":"dot","- ":"dash","--":"longdash","- .":"dashdot","--.":"longdashdot","--..":"longdashdotdot"};O.dashstyle=H[e](l["stroke-dasharray"])?H[l["stroke-dasharray"]]:d}Y&&c.appendChild(O)}if("text"==m.type){m.paper.canvas.style.display=d;var X=m.paper.span,U=100,$=f.font&&f.font.match(/\d+(?:\.\d*)?(?=px)/);g=X.style,f.font&&(g.font=f.font),f["font-family"]&&(g.fontFamily=f["font-family"]),f["font-weight"]&&(g.fontWeight=f["font-weight"]),f["font-style"]&&(g.fontStyle=f["font-style"]),$=i(f["font-size"]||$&&$[0])||10,g.fontSize=$*U+"px",m.textpath.string&&(X.innerHTML=r(m.textpath.string).replace(/</g,"&#60;").replace(/&/g,"&#38;").replace(/\n/g,"<br>"));var Z=X.getBoundingClientRect();m.W=f.w=(Z.right-Z.left)/U,m.H=f.h=(Z.bottom-Z.top)/U,m.X=f.x,m.Y=f.y+m.H/2,("x"in l||"y"in l)&&(m.path.v=t.format("m{0},{1}l{2},{1}",a(f.x*b),a(f.y*b),a(f.x*b)+1));for(var Q=["x","y","text","font","font-family","font-weight","font-style","font-size"],J=0,K=Q.length;K>J;J++)if(Q[J]in l){m._.dirty=1;break}switch(f["text-anchor"]){case"start":m.textpath.style["v-text-align"]="left",m.bbx=m.W/2;break;case"end":m.textpath.style["v-text-align"]="right",m.bbx=-m.W/2;break;default:m.textpath.style["v-text-align"]="center",m.bbx=0}m.textpath.style["v-text-kern"]=!0}},A=function(e,a,s){e.attrs=e.attrs||{};var o=e.attrs,l=Math.pow,h,u,c="linear",f=".5 .5";if(e.attrs.gradient=a,a=r(a).replace(t._radial_gradient,function(t,e,r){return c="radial",e&&r&&(e=i(e),r=i(r),l(e-.5,2)+l(r-.5,2)>.25&&(r=n.sqrt(.25-l(e-.5,2))*(2*(r>.5)-1)+.5),f=e+p+r),d}),a=a.split(/\s*\-\s*/),"linear"==c){var g=a.shift();if(g=-i(g),isNaN(g))return null}var x=t._parseDots(a);if(!x)return null;if(e=e.shape||e.node,x.length){e.removeChild(s),s.on=!0,s.method="none",s.color=x[0].color,s.color2=x[x.length-1].color;for(var v=[],y=0,m=x.length;m>y;y++)x[y].offset&&v.push(x[y].offset+p+x[y].color);s.colors=v.length?v.join():"0% "+s.color,"radial"==c?(s.type="gradientTitle",s.focus="100%",s.focussize="0 0",s.focusposition=f,s.angle=0):(s.type="gradient",s.angle=(270-g)%360),e.appendChild(s)}return 1},E=function(e,r){this[0]=this.node=e,e.raphael=!0,this.id=t._oid++,e.raphaelid=this.id,this.X=0,this.Y=0,this.attrs={},this.paper=r,this.matrix=t.matrix(),this._={transform:[],sx:1,sy:1,dx:0,dy:0,deg:0,dirty:1,dirtyT:1},!r.bottom&&(r.bottom=this),this.prev=r.top,r.top&&(r.top.next=this),r.top=this,this.next=null},N=t.el;E.prototype=N,N.constructor=E,N.transform=function(e){if(null==e)return this._.transform;var i=this.paper._viewBoxShift,n=i?"s"+[i.scale,i.scale]+"-1-1t"+[i.dx,i.dy]:d,a;i&&(a=e=r(e).replace(/\.{3}|\u2026/g,this._.transform||d)),t._extractTransform(this,n+e);var s=this.matrix.clone(),o=this.skew,l=this.node,h,u=~r(this.attrs.fill).indexOf("-"),c=!r(this.attrs.fill).indexOf("url(");if(s.translate(1,1),c||u||"image"==this.type)if(o.matrix="1 0 0 1",o.offset="0 0",h=s.split(),u&&h.noRotation||!h.isSimple){l.style.filter=s.toFilter();var f=this.getBBox(),g=this.getBBox(1),x=f.x-g.x,v=f.y-g.y;l.coordorigin=x*-b+p+v*-b,C(this,1,1,x,v,0)}else l.style.filter=d,C(this,h.scalex,h.scaley,h.dx,h.dy,h.rotate);else l.style.filter=d,o.matrix=r(s),o.offset=s.offset();return null!==a&&(this._.transform=a,t._extractTransform(this,a)),this},N.rotate=function(t,e,n){if(this.removed)return this;if(null!=t){if(t=r(t).split(u),t.length-1&&(e=i(t[1]),n=i(t[2])),t=i(t[0]),null==n&&(e=n),null==e||null==n){var a=this.getBBox(1);e=a.x+a.width/2,n=a.y+a.height/2}return this._.dirtyT=1,this.transform(this._.transform.concat([["r",t,e,n]])),this}},N.translate=function(t,e){return this.removed?this:(t=r(t).split(u),t.length-1&&(e=i(t[1])),t=i(t[0])||0,e=+e||0,this._.bbox&&(this._.bbox.x+=t,this._.bbox.y+=e),this.transform(this._.transform.concat([["t",t,e]])),this)},N.scale=function(t,e,n,a){if(this.removed)return this;if(t=r(t).split(u),t.length-1&&(e=i(t[1]),n=i(t[2]),a=i(t[3]),isNaN(n)&&(n=null),isNaN(a)&&(a=null)),t=i(t[0]),null==e&&(e=t),null==a&&(n=a),null==n||null==a)var s=this.getBBox(1);return n=null==n?s.x+s.width/2:n,a=null==a?s.y+s.height/2:a,this.transform(this._.transform.concat([["s",t,e,n,a]])),this._.dirtyT=1,this},N.hide=function(){return!this.removed&&(this.node.style.display="none"),this},N.show=function(){return!this.removed&&(this.node.style.display=d),this},N.auxGetBBox=t.el.getBBox,N.getBBox=function(){var t=this.auxGetBBox();if(this.paper&&this.paper._viewBoxShift){var e={},r=1/this.paper._viewBoxShift.scale;return e.x=t.x-this.paper._viewBoxShift.dx,e.x*=r,e.y=t.y-this.paper._viewBoxShift.dy,e.y*=r,e.width=t.width*r,e.height=t.height*r,e.x2=e.x+e.width,e.y2=e.y+e.height,e}return t},N._getBBox=function(){return this.removed?{}:{x:this.X+(this.bbx||0)-this.W/2,y:this.Y-this.H,width:this.W,height:this.H}},N.remove=function(){if(!this.removed&&this.node.parentNode){this.paper.__set__&&this.paper.__set__.exclude(this),t.eve.unbind("raphael.*.*."+this.id),t._tear(this,this.paper),this.node.parentNode.removeChild(this.node),this.shape&&this.shape.parentNode.removeChild(this.shape);for(var e in this)this[e]="function"==typeof this[e]?t._removedFactory(e):null;this.removed=!0}},N.attr=function(r,i){if(this.removed)return this;if(null==r){var n={};for(var a in this.attrs)this.attrs[e](a)&&(n[a]=this.attrs[a]);return n.gradient&&"none"==n.fill&&(n.fill=n.gradient)&&delete n.gradient,n.transform=this._.transform,n}if(null==i&&t.is(r,"string")){if(r==h&&"none"==this.attrs.fill&&this.attrs.gradient)return this.attrs.gradient;for(var s=r.split(u),o={},l=0,f=s.length;f>l;l++)r=s[l],r in this.attrs?o[r]=this.attrs[r]:t.is(this.paper.customAttributes[r],"function")?o[r]=this.paper.customAttributes[r].def:o[r]=t._availableAttrs[r];return f-1?o:o[s[0]]}if(this.attrs&&null==i&&t.is(r,"array")){for(o={},l=0,f=r.length;f>l;l++)o[r[l]]=this.attr(r[l]);return o}var p;null!=i&&(p={},p[r]=i),null==i&&t.is(r,"object")&&(p=r);for(var d in p)c("raphael.attr."+d+"."+this.id,this,p[d]);if(p){for(d in this.paper.customAttributes)if(this.paper.customAttributes[e](d)&&p[e](d)&&t.is(this.paper.customAttributes[d],"function")){var g=this.paper.customAttributes[d].apply(this,[].concat(p[d]));this.attrs[d]=p[d];for(var x in g)g[e](x)&&(p[x]=g[x])}p.text&&"text"==this.type&&(this.textpath.string=p.text),T(this,p)}return this},N.toFront=function(){return!this.removed&&this.node.parentNode.appendChild(this.node),this.paper&&this.paper.top!=this&&t._tofront(this,this.paper),this},N.toBack=function(){return this.removed?this:(this.node.parentNode.firstChild!=this.node&&(this.node.parentNode.insertBefore(this.node,this.node.parentNode.firstChild),t._toback(this,this.paper)),this)},N.insertAfter=function(e){return this.removed?this:(e.constructor==t.st.constructor&&(e=e[e.length-1]),e.node.nextSibling?e.node.parentNode.insertBefore(this.node,e.node.nextSibling):e.node.parentNode.appendChild(this.node),t._insertafter(this,e,this.paper),this)},N.insertBefore=function(e){return this.removed?this:(e.constructor==t.st.constructor&&(e=e[0]),e.node.parentNode.insertBefore(this.node,e.node),t._insertbefore(this,e,this.paper),this)},N.blur=function(e){var r=this.node.runtimeStyle,i=r.filter;return i=i.replace(v,d),0!==+e?(this.attrs.blur=e,r.filter=i+p+f+".Blur(pixelradius="+(+e||1.5)+")",r.margin=t.format("-{0}px 0 0 -{0}px",a(+e||1.5))):(r.filter=i,r.margin=0,delete this.attrs.blur),this},t._engine.path=function(t,e){var r=M("shape");r.style.cssText=m,r.coordsize=b+p+b,r.coordorigin=e.coordorigin;var i=new E(r,e),n={fill:"none",stroke:"#000"};t&&(n.path=t),i.type="path",i.path=[],i.Path=d,T(i,n),e.canvas&&e.canvas.appendChild(r);var a=M("skew");return a.on=!0,r.appendChild(a),i.skew=a,i.transform(d),i},t._engine.rect=function(e,r,i,n,a,s){var o=t._rectPath(r,i,n,a,s),l=e.path(o),h=l.attrs;return l.X=h.x=r,l.Y=h.y=i,l.W=h.width=n,l.H=h.height=a,h.r=s,h.path=o,l.type="rect",l},t._engine.ellipse=function(t,e,r,i,n){var a=t.path(),s=a.attrs;return a.X=e-i,a.Y=r-n,a.W=2*i,a.H=2*n,a.type="ellipse",T(a,{cx:e,cy:r,rx:i,ry:n}),a},t._engine.circle=function(t,e,r,i){var n=t.path(),a=n.attrs;return n.X=e-i,n.Y=r-i,n.W=n.H=2*i,n.type="circle",T(n,{cx:e,cy:r,r:i}),n},t._engine.image=function(e,r,i,n,a,s){var o=t._rectPath(i,n,a,s),l=e.path(o).attr({stroke:"none"}),u=l.attrs,c=l.node,f=c.getElementsByTagName(h)[0];return u.src=r,l.X=u.x=i,l.Y=u.y=n,l.W=u.width=a,l.H=u.height=s,u.path=o,l.type="image",f.parentNode==c&&c.removeChild(f),f.rotate=!0,f.src=r,f.type="tile",l._.fillpos=[i,n],l._.fillsize=[a,s],c.appendChild(f),C(l,1,1,0,0,0),l},t._engine.text=function(e,i,n,s){var o=M("shape"),l=M("path"),h=M("textpath");i=i||0,n=n||0,s=s||"",l.v=t.format("m{0},{1}l{2},{1}",a(i*b),a(n*b),a(i*b)+1),l.textpathok=!0,h.string=r(s),h.on=!0,o.style.cssText=m,o.coordsize=b+p+b,o.coordorigin="0 0";var u=new E(o,e),c={fill:"#000",stroke:"none",font:t._availableAttrs.font,text:s};u.shape=o,u.path=l,u.textpath=h,u.type="text",u.attrs.text=r(s),u.attrs.x=i,u.attrs.y=n,u.attrs.w=1,u.attrs.h=1,T(u,c),o.appendChild(h),o.appendChild(l),e.canvas.appendChild(o);var f=M("skew");return f.on=!0,o.appendChild(f),u.skew=f,u.transform(d),u},t._engine.setSize=function(e,r){var i=this.canvas.style;return this.width=e,this.height=r,e==+e&&(e+="px"),r==+r&&(r+="px"),i.width=e,i.height=r,i.clip="rect(0 "+e+" "+r+" 0)",this._viewBox&&t._engine.setViewBox.apply(this,this._viewBox),this},t._engine.setViewBox=function(e,r,i,n,a){t.eve("raphael.setViewBox",this,this._viewBox,[e,r,i,n,a]);var s=this.getSize(),o=s.width,l=s.height,h,u;return a&&(h=l/n,u=o/i,o>i*h&&(e-=(o-i*h)/2/h),l>n*u&&(r-=(l-n*u)/2/u)),this._viewBox=[e,r,i,n,!!a],this._viewBoxShift={dx:-e,dy:-r,scale:s},this.forEach(function(t){t.transform("...")}),this};var M;t._engine.initWin=function(t){var e=t.document;e.styleSheets.length<31?e.createStyleSheet().addRule(".rvml","behavior:url(#default#VML)"):e.styleSheets[0].addRule(".rvml","behavior:url(#default#VML)");try{!e.namespaces.rvml&&e.namespaces.add("rvml","urn:schemas-microsoft-com:vml"),M=function(t){return e.createElement("<rvml:"+t+' class="rvml">')}}catch(r){M=function(t){return e.createElement("<"+t+' xmlns="urn:schemas-microsoft.com:vml" class="rvml">')}}},t._engine.initWin(t._g.win),t._engine.create=function(){var e=t._getContainer.apply(0,arguments),r=e.container,i=e.height,n,a=e.width,s=e.x,o=e.y;if(!r)throw new Error("VML container not found.");var l=new t._Paper,h=l.canvas=t._g.doc.createElement("div"),u=h.style;return s=s||0,o=o||0,a=a||512,i=i||342,l.width=a,l.height=i,a==+a&&(a+="px"),i==+i&&(i+="px"),l.coordsize=1e3*b+p+1e3*b,l.coordorigin="0 0",l.span=t._g.doc.createElement("span"),l.span.style.cssText="position:absolute;left:-9999em;top:-9999em;padding:0;margin:0;line-height:1;",h.appendChild(l.span),u.cssText=t.format("top:0;left:0;width:{0};height:{1};display:inline-block;position:relative;clip:rect(0 {0} {1} 0);overflow:hidden",a,i),1==r?(t._g.doc.body.appendChild(h),u.left=s+"px",u.top=o+"px",u.position="absolute"):r.firstChild?r.insertBefore(h,r.firstChild):r.appendChild(h),l.renderfix=function(){},l},t.prototype.clear=function(){t.eve("raphael.clear",this),this.canvas.innerHTML=d,this.span=t._g.doc.createElement("span"),this.span.style.cssText="position:absolute;left:-9999em;top:-9999em;padding:0;margin:0;line-height:1;display:inline;",this.canvas.appendChild(this.span),this.bottom=this.top=null},t.prototype.remove=function(){t.eve("raphael.remove",this),this.canvas.parentNode.removeChild(this.canvas);for(var e in this)this[e]="function"==typeof this[e]?t._removedFactory(e):null;return!0};var L=t.st;for(var z in N)N[e](z)&&!L[e](z)&&(L[z]=function(t){return function(){var e=arguments;return this.forEach(function(r){r[t].apply(r,e)})}}(z))}}.apply(e,i),!(void 0!==n&&(t.exports=n))}])});
},{}],18:[function(require,module,exports){
var jazzicon = require('jazzicon');


(function(){
  document.addEventListener('DOMContentLoaded', function(){
    var icons = document.querySelectorAll('.user-icon');
    Array.prototype.forEach.call(icons, function(el, i){
      var num = parseInt( el.getAttribute('data-icon'), 10);
      var icon = jazzicon(48, num);
      el.appendChild(icon);
    });
  }); 
})();

},{"jazzicon":14}]},{},[18])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFzZTY0LWpzL2xpYi9iNjQuanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2J1ZmZlci9ub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jbG9uZS9jbG9uZS5qcyIsIm5vZGVfbW9kdWxlcy9jb2xvci1jb252ZXJ0L2NvbnZlcnNpb25zLmpzIiwibm9kZV9tb2R1bGVzL2NvbG9yLWNvbnZlcnQvY3NzLWtleXdvcmRzLmpzIiwibm9kZV9tb2R1bGVzL2NvbG9yLWNvbnZlcnQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvY29sb3ItY29udmVydC9yb3V0ZS5qcyIsIm5vZGVfbW9kdWxlcy9jb2xvci1uYW1lL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2NvbG9yLXN0cmluZy9jb2xvci1zdHJpbmcuanMiLCJub2RlX21vZHVsZXMvY29sb3IvaW5kZXguanMiLCJub2RlX21vZHVsZXMvaWVlZTc1NC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9qYXp6aWNvbi9jb2xvcnMuanMiLCJub2RlX21vZHVsZXMvamF6emljb24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvamF6emljb24vcGFwZXIuanMiLCJub2RlX21vZHVsZXMvbWVyc2VubmUtdHdpc3Rlci9zcmMvbWVyc2VubmUtdHdpc3Rlci5qcyIsIm5vZGVfbW9kdWxlcy9yYXBoYWVsL3JhcGhhZWwubWluLmpzIiwicHVibGljL3NyYy9qcy9tYWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDN0dBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDanJEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2d0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3TkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdNQTtBQUNBO0FBQ0E7O0FDRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCdcblxuZXhwb3J0cy50b0J5dGVBcnJheSA9IHRvQnl0ZUFycmF5XG5leHBvcnRzLmZyb21CeXRlQXJyYXkgPSBmcm9tQnl0ZUFycmF5XG5cbnZhciBsb29rdXAgPSBbXVxudmFyIHJldkxvb2t1cCA9IFtdXG52YXIgQXJyID0gdHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnID8gVWludDhBcnJheSA6IEFycmF5XG5cbmZ1bmN0aW9uIGluaXQgKCkge1xuICB2YXIgY29kZSA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29kZS5sZW5ndGg7IGkgPCBsZW47ICsraSkge1xuICAgIGxvb2t1cFtpXSA9IGNvZGVbaV1cbiAgICByZXZMb29rdXBbY29kZS5jaGFyQ29kZUF0KGkpXSA9IGlcbiAgfVxuXG4gIHJldkxvb2t1cFsnLScuY2hhckNvZGVBdCgwKV0gPSA2MlxuICByZXZMb29rdXBbJ18nLmNoYXJDb2RlQXQoMCldID0gNjNcbn1cblxuaW5pdCgpXG5cbmZ1bmN0aW9uIHRvQnl0ZUFycmF5IChiNjQpIHtcbiAgdmFyIGksIGosIGwsIHRtcCwgcGxhY2VIb2xkZXJzLCBhcnJcbiAgdmFyIGxlbiA9IGI2NC5sZW5ndGhcblxuICBpZiAobGVuICUgNCA+IDApIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICB9XG5cbiAgLy8gdGhlIG51bWJlciBvZiBlcXVhbCBzaWducyAocGxhY2UgaG9sZGVycylcbiAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAvLyByZXByZXNlbnQgb25lIGJ5dGVcbiAgLy8gaWYgdGhlcmUgaXMgb25seSBvbmUsIHRoZW4gdGhlIHRocmVlIGNoYXJhY3RlcnMgYmVmb3JlIGl0IHJlcHJlc2VudCAyIGJ5dGVzXG4gIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgcGxhY2VIb2xkZXJzID0gYjY0W2xlbiAtIDJdID09PSAnPScgPyAyIDogYjY0W2xlbiAtIDFdID09PSAnPScgPyAxIDogMFxuXG4gIC8vIGJhc2U2NCBpcyA0LzMgKyB1cCB0byB0d28gY2hhcmFjdGVycyBvZiB0aGUgb3JpZ2luYWwgZGF0YVxuICBhcnIgPSBuZXcgQXJyKGxlbiAqIDMgLyA0IC0gcGxhY2VIb2xkZXJzKVxuXG4gIC8vIGlmIHRoZXJlIGFyZSBwbGFjZWhvbGRlcnMsIG9ubHkgZ2V0IHVwIHRvIHRoZSBsYXN0IGNvbXBsZXRlIDQgY2hhcnNcbiAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBsZW4gLSA0IDogbGVuXG5cbiAgdmFyIEwgPSAwXG5cbiAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDE4KSB8IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDEpXSA8PCAxMikgfCAocmV2TG9va3VwW2I2NC5jaGFyQ29kZUF0KGkgKyAyKV0gPDwgNikgfCByZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSArIDMpXVxuICAgIGFycltMKytdID0gKHRtcCA+PiAxNikgJiAweEZGXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgaWYgKHBsYWNlSG9sZGVycyA9PT0gMikge1xuICAgIHRtcCA9IChyZXZMb29rdXBbYjY0LmNoYXJDb2RlQXQoaSldIDw8IDIpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldID4+IDQpXG4gICAgYXJyW0wrK10gPSB0bXAgJiAweEZGXG4gIH0gZWxzZSBpZiAocGxhY2VIb2xkZXJzID09PSAxKSB7XG4gICAgdG1wID0gKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpKV0gPDwgMTApIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMSldIDw8IDQpIHwgKHJldkxvb2t1cFtiNjQuY2hhckNvZGVBdChpICsgMildID4+IDIpXG4gICAgYXJyW0wrK10gPSAodG1wID4+IDgpICYgMHhGRlxuICAgIGFycltMKytdID0gdG1wICYgMHhGRlxuICB9XG5cbiAgcmV0dXJuIGFyclxufVxuXG5mdW5jdGlvbiB0cmlwbGV0VG9CYXNlNjQgKG51bSkge1xuICByZXR1cm4gbG9va3VwW251bSA+PiAxOCAmIDB4M0ZdICsgbG9va3VwW251bSA+PiAxMiAmIDB4M0ZdICsgbG9va3VwW251bSA+PiA2ICYgMHgzRl0gKyBsb29rdXBbbnVtICYgMHgzRl1cbn1cblxuZnVuY3Rpb24gZW5jb2RlQ2h1bmsgKHVpbnQ4LCBzdGFydCwgZW5kKSB7XG4gIHZhciB0bXBcbiAgdmFyIG91dHB1dCA9IFtdXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSArPSAzKSB7XG4gICAgdG1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuICAgIG91dHB1dC5wdXNoKHRyaXBsZXRUb0Jhc2U2NCh0bXApKVxuICB9XG4gIHJldHVybiBvdXRwdXQuam9pbignJylcbn1cblxuZnVuY3Rpb24gZnJvbUJ5dGVBcnJheSAodWludDgpIHtcbiAgdmFyIHRtcFxuICB2YXIgbGVuID0gdWludDgubGVuZ3RoXG4gIHZhciBleHRyYUJ5dGVzID0gbGVuICUgMyAvLyBpZiB3ZSBoYXZlIDEgYnl0ZSBsZWZ0LCBwYWQgMiBieXRlc1xuICB2YXIgb3V0cHV0ID0gJydcbiAgdmFyIHBhcnRzID0gW11cbiAgdmFyIG1heENodW5rTGVuZ3RoID0gMTYzODMgLy8gbXVzdCBiZSBtdWx0aXBsZSBvZiAzXG5cbiAgLy8gZ28gdGhyb3VnaCB0aGUgYXJyYXkgZXZlcnkgdGhyZWUgYnl0ZXMsIHdlJ2xsIGRlYWwgd2l0aCB0cmFpbGluZyBzdHVmZiBsYXRlclxuICBmb3IgKHZhciBpID0gMCwgbGVuMiA9IGxlbiAtIGV4dHJhQnl0ZXM7IGkgPCBsZW4yOyBpICs9IG1heENodW5rTGVuZ3RoKSB7XG4gICAgcGFydHMucHVzaChlbmNvZGVDaHVuayh1aW50OCwgaSwgKGkgKyBtYXhDaHVua0xlbmd0aCkgPiBsZW4yID8gbGVuMiA6IChpICsgbWF4Q2h1bmtMZW5ndGgpKSlcbiAgfVxuXG4gIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgaWYgKGV4dHJhQnl0ZXMgPT09IDEpIHtcbiAgICB0bXAgPSB1aW50OFtsZW4gLSAxXVxuICAgIG91dHB1dCArPSBsb29rdXBbdG1wID4+IDJdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wIDw8IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gJz09J1xuICB9IGVsc2UgaWYgKGV4dHJhQnl0ZXMgPT09IDIpIHtcbiAgICB0bXAgPSAodWludDhbbGVuIC0gMl0gPDwgOCkgKyAodWludDhbbGVuIC0gMV0pXG4gICAgb3V0cHV0ICs9IGxvb2t1cFt0bXAgPj4gMTBdXG4gICAgb3V0cHV0ICs9IGxvb2t1cFsodG1wID4+IDQpICYgMHgzRl1cbiAgICBvdXRwdXQgKz0gbG9va3VwWyh0bXAgPDwgMikgJiAweDNGXVxuICAgIG91dHB1dCArPSAnPSdcbiAgfVxuXG4gIHBhcnRzLnB1c2gob3V0cHV0KVxuXG4gIHJldHVybiBwYXJ0cy5qb2luKCcnKVxufVxuIiwiLyohXG4gKiBUaGUgYnVmZmVyIG1vZHVsZSBmcm9tIG5vZGUuanMsIGZvciB0aGUgYnJvd3Nlci5cbiAqXG4gKiBAYXV0aG9yICAgRmVyb3NzIEFib3VraGFkaWplaCA8ZmVyb3NzQGZlcm9zcy5vcmc+IDxodHRwOi8vZmVyb3NzLm9yZz5cbiAqIEBsaWNlbnNlICBNSVRcbiAqL1xuLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cblxuJ3VzZSBzdHJpY3QnXG5cbnZhciBiYXNlNjQgPSByZXF1aXJlKCdiYXNlNjQtanMnKVxudmFyIGllZWU3NTQgPSByZXF1aXJlKCdpZWVlNzU0JylcbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbmV4cG9ydHMuQnVmZmVyID0gQnVmZmVyXG5leHBvcnRzLlNsb3dCdWZmZXIgPSBTbG93QnVmZmVyXG5leHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTID0gNTBcblxuLyoqXG4gKiBJZiBgQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRgOlxuICogICA9PT0gdHJ1ZSAgICBVc2UgVWludDhBcnJheSBpbXBsZW1lbnRhdGlvbiAoZmFzdGVzdClcbiAqICAgPT09IGZhbHNlICAgVXNlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiAobW9zdCBjb21wYXRpYmxlLCBldmVuIElFNilcbiAqXG4gKiBCcm93c2VycyB0aGF0IHN1cHBvcnQgdHlwZWQgYXJyYXlzIGFyZSBJRSAxMCssIEZpcmVmb3ggNCssIENocm9tZSA3KywgU2FmYXJpIDUuMSssXG4gKiBPcGVyYSAxMS42KywgaU9TIDQuMisuXG4gKlxuICogRHVlIHRvIHZhcmlvdXMgYnJvd3NlciBidWdzLCBzb21ldGltZXMgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiB3aWxsIGJlIHVzZWQgZXZlblxuICogd2hlbiB0aGUgYnJvd3NlciBzdXBwb3J0cyB0eXBlZCBhcnJheXMuXG4gKlxuICogTm90ZTpcbiAqXG4gKiAgIC0gRmlyZWZveCA0LTI5IGxhY2tzIHN1cHBvcnQgZm9yIGFkZGluZyBuZXcgcHJvcGVydGllcyB0byBgVWludDhBcnJheWAgaW5zdGFuY2VzLFxuICogICAgIFNlZTogaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9Njk1NDM4LlxuICpcbiAqICAgLSBDaHJvbWUgOS0xMCBpcyBtaXNzaW5nIHRoZSBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uLlxuICpcbiAqICAgLSBJRTEwIGhhcyBhIGJyb2tlbiBgVHlwZWRBcnJheS5wcm90b3R5cGUuc3ViYXJyYXlgIGZ1bmN0aW9uIHdoaWNoIHJldHVybnMgYXJyYXlzIG9mXG4gKiAgICAgaW5jb3JyZWN0IGxlbmd0aCBpbiBzb21lIHNpdHVhdGlvbnMuXG5cbiAqIFdlIGRldGVjdCB0aGVzZSBidWdneSBicm93c2VycyBhbmQgc2V0IGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGAgdG8gYGZhbHNlYCBzbyB0aGV5XG4gKiBnZXQgdGhlIE9iamVjdCBpbXBsZW1lbnRhdGlvbiwgd2hpY2ggaXMgc2xvd2VyIGJ1dCBiZWhhdmVzIGNvcnJlY3RseS5cbiAqL1xuQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQgPSBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVCAhPT0gdW5kZWZpbmVkXG4gID8gZ2xvYmFsLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgOiB0eXBlZEFycmF5U3VwcG9ydCgpXG5cbi8qXG4gKiBFeHBvcnQga01heExlbmd0aCBhZnRlciB0eXBlZCBhcnJheSBzdXBwb3J0IGlzIGRldGVybWluZWQuXG4gKi9cbmV4cG9ydHMua01heExlbmd0aCA9IGtNYXhMZW5ndGgoKVxuXG5mdW5jdGlvbiB0eXBlZEFycmF5U3VwcG9ydCAoKSB7XG4gIHRyeSB7XG4gICAgdmFyIGFyciA9IG5ldyBVaW50OEFycmF5KDEpXG4gICAgYXJyLl9fcHJvdG9fXyA9IHtfX3Byb3RvX186IFVpbnQ4QXJyYXkucHJvdG90eXBlLCBmb286IGZ1bmN0aW9uICgpIHsgcmV0dXJuIDQyIH19XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuZnVuY3Rpb24gY3JlYXRlQnVmZmVyICh0aGF0LCBsZW5ndGgpIHtcbiAgaWYgKGtNYXhMZW5ndGgoKSA8IGxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aCcpXG4gIH1cbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gUmV0dXJuIGFuIGF1Z21lbnRlZCBgVWludDhBcnJheWAgaW5zdGFuY2UsIGZvciBiZXN0IHBlcmZvcm1hbmNlXG4gICAgdGhhdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aClcbiAgICB0aGF0Ll9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICAvLyBGYWxsYmFjazogUmV0dXJuIGFuIG9iamVjdCBpbnN0YW5jZSBvZiB0aGUgQnVmZmVyIGNsYXNzXG4gICAgaWYgKHRoYXQgPT09IG51bGwpIHtcbiAgICAgIHRoYXQgPSBuZXcgQnVmZmVyKGxlbmd0aClcbiAgICB9XG4gICAgdGhhdC5sZW5ndGggPSBsZW5ndGhcbiAgfVxuXG4gIHJldHVybiB0aGF0XG59XG5cbi8qKlxuICogVGhlIEJ1ZmZlciBjb25zdHJ1Y3RvciByZXR1cm5zIGluc3RhbmNlcyBvZiBgVWludDhBcnJheWAgdGhhdCBoYXZlIHRoZWlyXG4gKiBwcm90b3R5cGUgY2hhbmdlZCB0byBgQnVmZmVyLnByb3RvdHlwZWAuIEZ1cnRoZXJtb3JlLCBgQnVmZmVyYCBpcyBhIHN1YmNsYXNzIG9mXG4gKiBgVWludDhBcnJheWAsIHNvIHRoZSByZXR1cm5lZCBpbnN0YW5jZXMgd2lsbCBoYXZlIGFsbCB0aGUgbm9kZSBgQnVmZmVyYCBtZXRob2RzXG4gKiBhbmQgdGhlIGBVaW50OEFycmF5YCBtZXRob2RzLiBTcXVhcmUgYnJhY2tldCBub3RhdGlvbiB3b3JrcyBhcyBleHBlY3RlZCAtLSBpdFxuICogcmV0dXJucyBhIHNpbmdsZSBvY3RldC5cbiAqXG4gKiBUaGUgYFVpbnQ4QXJyYXlgIHByb3RvdHlwZSByZW1haW5zIHVubW9kaWZpZWQuXG4gKi9cblxuZnVuY3Rpb24gQnVmZmVyIChhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmICEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICByZXR1cm4gbmV3IEJ1ZmZlcihhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIC8vIENvbW1vbiBjYXNlLlxuICBpZiAodHlwZW9mIGFyZyA9PT0gJ251bWJlcicpIHtcbiAgICBpZiAodHlwZW9mIGVuY29kaW5nT3JPZmZzZXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICdJZiBlbmNvZGluZyBpcyBzcGVjaWZpZWQgdGhlbiB0aGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIHN0cmluZydcbiAgICAgIClcbiAgICB9XG4gICAgcmV0dXJuIGFsbG9jVW5zYWZlKHRoaXMsIGFyZylcbiAgfVxuICByZXR1cm4gZnJvbSh0aGlzLCBhcmcsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnBvb2xTaXplID0gODE5MiAvLyBub3QgdXNlZCBieSB0aGlzIGltcGxlbWVudGF0aW9uXG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb20gKHRoYXQsIHZhbHVlLCBlbmNvZGluZ09yT2Zmc2V0LCBsZW5ndGgpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInZhbHVlXCIgYXJndW1lbnQgbXVzdCBub3QgYmUgYSBudW1iZXInKVxuICB9XG5cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdmFsdWUgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgIHJldHVybiBmcm9tQXJyYXlCdWZmZXIodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgcmV0dXJuIGZyb21TdHJpbmcodGhhdCwgdmFsdWUsIGVuY29kaW5nT3JPZmZzZXQpXG4gIH1cblxuICByZXR1cm4gZnJvbU9iamVjdCh0aGF0LCB2YWx1ZSlcbn1cblxuLyoqXG4gKiBGdW5jdGlvbmFsbHkgZXF1aXZhbGVudCB0byBCdWZmZXIoYXJnLCBlbmNvZGluZykgYnV0IHRocm93cyBhIFR5cGVFcnJvclxuICogaWYgdmFsdWUgaXMgYSBudW1iZXIuXG4gKiBCdWZmZXIuZnJvbShzdHJbLCBlbmNvZGluZ10pXG4gKiBCdWZmZXIuZnJvbShhcnJheSlcbiAqIEJ1ZmZlci5mcm9tKGJ1ZmZlcilcbiAqIEJ1ZmZlci5mcm9tKGFycmF5QnVmZmVyWywgYnl0ZU9mZnNldFssIGxlbmd0aF1dKVxuICoqL1xuQnVmZmVyLmZyb20gPSBmdW5jdGlvbiAodmFsdWUsIGVuY29kaW5nT3JPZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gZnJvbShudWxsLCB2YWx1ZSwgZW5jb2RpbmdPck9mZnNldCwgbGVuZ3RoKVxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxuICBpZiAodHlwZW9mIFN5bWJvbCAhPT0gJ3VuZGVmaW5lZCcgJiYgU3ltYm9sLnNwZWNpZXMgJiZcbiAgICAgIEJ1ZmZlcltTeW1ib2wuc3BlY2llc10gPT09IEJ1ZmZlcikge1xuICAgIC8vIEZpeCBzdWJhcnJheSgpIGluIEVTMjAxNi4gU2VlOiBodHRwczovL2dpdGh1Yi5jb20vZmVyb3NzL2J1ZmZlci9wdWxsLzk3XG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEJ1ZmZlciwgU3ltYm9sLnNwZWNpZXMsIHtcbiAgICAgIHZhbHVlOiBudWxsLFxuICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgfSlcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRTaXplIChzaXplKSB7XG4gIGlmICh0eXBlb2Ygc2l6ZSAhPT0gJ251bWJlcicpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcInNpemVcIiBhcmd1bWVudCBtdXN0IGJlIGEgbnVtYmVyJylcbiAgfVxufVxuXG5mdW5jdGlvbiBhbGxvYyAodGhhdCwgc2l6ZSwgZmlsbCwgZW5jb2RpbmcpIHtcbiAgYXNzZXJ0U2l6ZShzaXplKVxuICBpZiAoc2l6ZSA8PSAwKSB7XG4gICAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKVxuICB9XG4gIGlmIChmaWxsICE9PSB1bmRlZmluZWQpIHtcbiAgICAvLyBPbmx5IHBheSBhdHRlbnRpb24gdG8gZW5jb2RpbmcgaWYgaXQncyBhIHN0cmluZy4gVGhpc1xuICAgIC8vIHByZXZlbnRzIGFjY2lkZW50YWxseSBzZW5kaW5nIGluIGEgbnVtYmVyIHRoYXQgd291bGRcbiAgICAvLyBiZSBpbnRlcnByZXR0ZWQgYXMgYSBzdGFydCBvZmZzZXQuXG4gICAgcmV0dXJuIHR5cGVvZiBlbmNvZGluZyA9PT0gJ3N0cmluZydcbiAgICAgID8gY3JlYXRlQnVmZmVyKHRoYXQsIHNpemUpLmZpbGwoZmlsbCwgZW5jb2RpbmcpXG4gICAgICA6IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKS5maWxsKGZpbGwpXG4gIH1cbiAgcmV0dXJuIGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplKVxufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBuZXcgZmlsbGVkIEJ1ZmZlciBpbnN0YW5jZS5cbiAqIGFsbG9jKHNpemVbLCBmaWxsWywgZW5jb2RpbmddXSlcbiAqKi9cbkJ1ZmZlci5hbGxvYyA9IGZ1bmN0aW9uIChzaXplLCBmaWxsLCBlbmNvZGluZykge1xuICByZXR1cm4gYWxsb2MobnVsbCwgc2l6ZSwgZmlsbCwgZW5jb2RpbmcpXG59XG5cbmZ1bmN0aW9uIGFsbG9jVW5zYWZlICh0aGF0LCBzaXplKSB7XG4gIGFzc2VydFNpemUoc2l6ZSlcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBzaXplIDwgMCA/IDAgOiBjaGVja2VkKHNpemUpIHwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2l6ZTsgKytpKSB7XG4gICAgICB0aGF0W2ldID0gMFxuICAgIH1cbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gQnVmZmVyKG51bSksIGJ5IGRlZmF1bHQgY3JlYXRlcyBhIG5vbi16ZXJvLWZpbGxlZCBCdWZmZXIgaW5zdGFuY2UuXG4gKiAqL1xuQnVmZmVyLmFsbG9jVW5zYWZlID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKG51bGwsIHNpemUpXG59XG4vKipcbiAqIEVxdWl2YWxlbnQgdG8gU2xvd0J1ZmZlcihudW0pLCBieSBkZWZhdWx0IGNyZWF0ZXMgYSBub24temVyby1maWxsZWQgQnVmZmVyIGluc3RhbmNlLlxuICovXG5CdWZmZXIuYWxsb2NVbnNhZmVTbG93ID0gZnVuY3Rpb24gKHNpemUpIHtcbiAgcmV0dXJuIGFsbG9jVW5zYWZlKG51bGwsIHNpemUpXG59XG5cbmZ1bmN0aW9uIGZyb21TdHJpbmcgKHRoYXQsIHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycgfHwgZW5jb2RpbmcgPT09ICcnKSB7XG4gICAgZW5jb2RpbmcgPSAndXRmOCdcbiAgfVxuXG4gIGlmICghQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJlbmNvZGluZ1wiIG11c3QgYmUgYSB2YWxpZCBzdHJpbmcgZW5jb2RpbmcnKVxuICB9XG5cbiAgdmFyIGxlbmd0aCA9IGJ5dGVMZW5ndGgoc3RyaW5nLCBlbmNvZGluZykgfCAwXG4gIHRoYXQgPSBjcmVhdGVCdWZmZXIodGhhdCwgbGVuZ3RoKVxuXG4gIHRoYXQud3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW5ndGgpXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tQXJyYXlCdWZmZXIgKHRoYXQsIGFycmF5LCBieXRlT2Zmc2V0LCBsZW5ndGgpIHtcbiAgYXJyYXkuYnl0ZUxlbmd0aCAvLyB0aGlzIHRocm93cyBpZiBgYXJyYXlgIGlzIG5vdCBhIHZhbGlkIEFycmF5QnVmZmVyXG5cbiAgaWYgKGJ5dGVPZmZzZXQgPCAwIHx8IGFycmF5LmJ5dGVMZW5ndGggPCBieXRlT2Zmc2V0KSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ1xcJ29mZnNldFxcJyBpcyBvdXQgb2YgYm91bmRzJylcbiAgfVxuXG4gIGlmIChhcnJheS5ieXRlTGVuZ3RoIDwgYnl0ZU9mZnNldCArIChsZW5ndGggfHwgMCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXFwnbGVuZ3RoXFwnIGlzIG91dCBvZiBib3VuZHMnKVxuICB9XG5cbiAgaWYgKGJ5dGVPZmZzZXQgPT09IHVuZGVmaW5lZCAmJiBsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gIH0gZWxzZSBpZiAobGVuZ3RoID09PSB1bmRlZmluZWQpIHtcbiAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5LCBieXRlT2Zmc2V0KVxuICB9IGVsc2Uge1xuICAgIGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXksIGJ5dGVPZmZzZXQsIGxlbmd0aClcbiAgfVxuXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIC8vIFJldHVybiBhbiBhdWdtZW50ZWQgYFVpbnQ4QXJyYXlgIGluc3RhbmNlLCBmb3IgYmVzdCBwZXJmb3JtYW5jZVxuICAgIHRoYXQgPSBhcnJheVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0ID0gZnJvbUFycmF5TGlrZSh0aGF0LCBhcnJheSlcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBmcm9tT2JqZWN0ICh0aGF0LCBvYmopIHtcbiAgaWYgKEJ1ZmZlci5pc0J1ZmZlcihvYmopKSB7XG4gICAgdmFyIGxlbiA9IGNoZWNrZWQob2JqLmxlbmd0aCkgfCAwXG4gICAgdGhhdCA9IGNyZWF0ZUJ1ZmZlcih0aGF0LCBsZW4pXG5cbiAgICBpZiAodGhhdC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB0aGF0XG4gICAgfVxuXG4gICAgb2JqLmNvcHkodGhhdCwgMCwgMCwgbGVuKVxuICAgIHJldHVybiB0aGF0XG4gIH1cblxuICBpZiAob2JqKSB7XG4gICAgaWYgKCh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICAgIG9iai5idWZmZXIgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikgfHwgJ2xlbmd0aCcgaW4gb2JqKSB7XG4gICAgICBpZiAodHlwZW9mIG9iai5sZW5ndGggIT09ICdudW1iZXInIHx8IGlzbmFuKG9iai5sZW5ndGgpKSB7XG4gICAgICAgIHJldHVybiBjcmVhdGVCdWZmZXIodGhhdCwgMClcbiAgICAgIH1cbiAgICAgIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iailcbiAgICB9XG5cbiAgICBpZiAob2JqLnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqLmRhdGEpKSB7XG4gICAgICByZXR1cm4gZnJvbUFycmF5TGlrZSh0aGF0LCBvYmouZGF0YSlcbiAgICB9XG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nLCBCdWZmZXIsIEFycmF5QnVmZmVyLCBBcnJheSwgb3IgYXJyYXktbGlrZSBvYmplY3QuJylcbn1cblxuZnVuY3Rpb24gY2hlY2tlZCAobGVuZ3RoKSB7XG4gIC8vIE5vdGU6IGNhbm5vdCB1c2UgYGxlbmd0aCA8IGtNYXhMZW5ndGhgIGhlcmUgYmVjYXVzZSB0aGF0IGZhaWxzIHdoZW5cbiAgLy8gbGVuZ3RoIGlzIE5hTiAod2hpY2ggaXMgb3RoZXJ3aXNlIGNvZXJjZWQgdG8gemVyby4pXG4gIGlmIChsZW5ndGggPj0ga01heExlbmd0aCgpKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gYWxsb2NhdGUgQnVmZmVyIGxhcmdlciB0aGFuIG1heGltdW0gJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgJ3NpemU6IDB4JyArIGtNYXhMZW5ndGgoKS50b1N0cmluZygxNikgKyAnIGJ5dGVzJylcbiAgfVxuICByZXR1cm4gbGVuZ3RoIHwgMFxufVxuXG5mdW5jdGlvbiBTbG93QnVmZmVyIChsZW5ndGgpIHtcbiAgaWYgKCtsZW5ndGggIT0gbGVuZ3RoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgZXFlcWVxXG4gICAgbGVuZ3RoID0gMFxuICB9XG4gIHJldHVybiBCdWZmZXIuYWxsb2MoK2xlbmd0aClcbn1cblxuQnVmZmVyLmlzQnVmZmVyID0gZnVuY3Rpb24gaXNCdWZmZXIgKGIpIHtcbiAgcmV0dXJuICEhKGIgIT0gbnVsbCAmJiBiLl9pc0J1ZmZlcilcbn1cblxuQnVmZmVyLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlIChhLCBiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGEpIHx8ICFCdWZmZXIuaXNCdWZmZXIoYikpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgbXVzdCBiZSBCdWZmZXJzJylcbiAgfVxuXG4gIGlmIChhID09PSBiKSByZXR1cm4gMFxuXG4gIHZhciB4ID0gYS5sZW5ndGhcbiAgdmFyIHkgPSBiLmxlbmd0aFxuXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBNYXRoLm1pbih4LCB5KTsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIHtcbiAgICAgIHggPSBhW2ldXG4gICAgICB5ID0gYltpXVxuICAgICAgYnJlYWtcbiAgICB9XG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdcImxpc3RcIiBhcmd1bWVudCBtdXN0IGJlIGFuIEFycmF5IG9mIEJ1ZmZlcnMnKVxuICB9XG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIEJ1ZmZlci5hbGxvYygwKVxuICB9XG5cbiAgdmFyIGlcbiAgaWYgKGxlbmd0aCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgbGVuZ3RoID0gMFxuICAgIGZvciAoaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgKytpKSB7XG4gICAgICBsZW5ndGggKz0gbGlzdFtpXS5sZW5ndGhcbiAgICB9XG4gIH1cblxuICB2YXIgYnVmZmVyID0gQnVmZmVyLmFsbG9jVW5zYWZlKGxlbmd0aClcbiAgdmFyIHBvcyA9IDBcbiAgZm9yIChpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIgYnVmID0gbGlzdFtpXVxuICAgIGlmICghQnVmZmVyLmlzQnVmZmVyKGJ1ZikpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1wibGlzdFwiIGFyZ3VtZW50IG11c3QgYmUgYW4gQXJyYXkgb2YgQnVmZmVycycpXG4gICAgfVxuICAgIGJ1Zi5jb3B5KGJ1ZmZlciwgcG9zKVxuICAgIHBvcyArPSBidWYubGVuZ3RoXG4gIH1cbiAgcmV0dXJuIGJ1ZmZlclxufVxuXG5mdW5jdGlvbiBieXRlTGVuZ3RoIChzdHJpbmcsIGVuY29kaW5nKSB7XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIoc3RyaW5nKSkge1xuICAgIHJldHVybiBzdHJpbmcubGVuZ3RoXG4gIH1cbiAgaWYgKHR5cGVvZiBBcnJheUJ1ZmZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIEFycmF5QnVmZmVyLmlzVmlldyA9PT0gJ2Z1bmN0aW9uJyAmJlxuICAgICAgKEFycmF5QnVmZmVyLmlzVmlldyhzdHJpbmcpIHx8IHN0cmluZyBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKSkge1xuICAgIHJldHVybiBzdHJpbmcuYnl0ZUxlbmd0aFxuICB9XG4gIGlmICh0eXBlb2Ygc3RyaW5nICE9PSAnc3RyaW5nJykge1xuICAgIHN0cmluZyA9ICcnICsgc3RyaW5nXG4gIH1cblxuICB2YXIgbGVuID0gc3RyaW5nLmxlbmd0aFxuICBpZiAobGVuID09PSAwKSByZXR1cm4gMFxuXG4gIC8vIFVzZSBhIGZvciBsb29wIHRvIGF2b2lkIHJlY3Vyc2lvblxuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuICBmb3IgKDs7KSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnYXNjaWknOlxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgIGNhc2UgJ3Jhdyc6XG4gICAgICBjYXNlICdyYXdzJzpcbiAgICAgICAgcmV0dXJuIGxlblxuICAgICAgY2FzZSAndXRmOCc6XG4gICAgICBjYXNlICd1dGYtOCc6XG4gICAgICBjYXNlIHVuZGVmaW5lZDpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIC8vIE5vIG5lZWQgdG8gdmVyaWZ5IHRoYXQgXCJ0aGlzLmxlbmd0aCA8PSBNQVhfVUlOVDMyXCIgc2luY2UgaXQncyBhIHJlYWQtb25seVxuICAvLyBwcm9wZXJ0eSBvZiBhIHR5cGVkIGFycmF5LlxuXG4gIC8vIFRoaXMgYmVoYXZlcyBuZWl0aGVyIGxpa2UgU3RyaW5nIG5vciBVaW50OEFycmF5IGluIHRoYXQgd2Ugc2V0IHN0YXJ0L2VuZFxuICAvLyB0byB0aGVpciB1cHBlci9sb3dlciBib3VuZHMgaWYgdGhlIHZhbHVlIHBhc3NlZCBpcyBvdXQgb2YgcmFuZ2UuXG4gIC8vIHVuZGVmaW5lZCBpcyBoYW5kbGVkIHNwZWNpYWxseSBhcyBwZXIgRUNNQS0yNjIgNnRoIEVkaXRpb24sXG4gIC8vIFNlY3Rpb24gMTMuMy4zLjcgUnVudGltZSBTZW1hbnRpY3M6IEtleWVkQmluZGluZ0luaXRpYWxpemF0aW9uLlxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCB8fCBzdGFydCA8IDApIHtcbiAgICBzdGFydCA9IDBcbiAgfVxuICAvLyBSZXR1cm4gZWFybHkgaWYgc3RhcnQgPiB0aGlzLmxlbmd0aC4gRG9uZSBoZXJlIHRvIHByZXZlbnQgcG90ZW50aWFsIHVpbnQzMlxuICAvLyBjb2VyY2lvbiBmYWlsIGJlbG93LlxuICBpZiAoc3RhcnQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgaWYgKGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgZW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChlbmQgPD0gMCkge1xuICAgIHJldHVybiAnJ1xuICB9XG5cbiAgLy8gRm9yY2UgY29lcnNpb24gdG8gdWludDMyLiBUaGlzIHdpbGwgYWxzbyBjb2VyY2UgZmFsc2V5L05hTiB2YWx1ZXMgdG8gMC5cbiAgZW5kID4+Pj0gMFxuICBzdGFydCA+Pj49IDBcblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuICcnXG4gIH1cblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgc3dpdGNoIChlbmNvZGluZykge1xuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGhleFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ3V0ZjgnOlxuICAgICAgY2FzZSAndXRmLTgnOlxuICAgICAgICByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2FzY2lpJzpcbiAgICAgICAgcmV0dXJuIGFzY2lpU2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAnYmluYXJ5JzpcbiAgICAgICAgcmV0dXJuIGJpbmFyeVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2Jhc2U2NCc6XG4gICAgICAgIHJldHVybiBiYXNlNjRTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gdXRmMTZsZVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgdGhyb3cgbmV3IFR5cGVFcnJvcignVW5rbm93biBlbmNvZGluZzogJyArIGVuY29kaW5nKVxuICAgICAgICBlbmNvZGluZyA9IChlbmNvZGluZyArICcnKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgIGxvd2VyZWRDYXNlID0gdHJ1ZVxuICAgIH1cbiAgfVxufVxuXG4vLyBUaGUgcHJvcGVydHkgaXMgdXNlZCBieSBgQnVmZmVyLmlzQnVmZmVyYCBhbmQgYGlzLWJ1ZmZlcmAgKGluIFNhZmFyaSA1LTcpIHRvIGRldGVjdFxuLy8gQnVmZmVyIGluc3RhbmNlcy5cbkJ1ZmZlci5wcm90b3R5cGUuX2lzQnVmZmVyID0gdHJ1ZVxuXG5mdW5jdGlvbiBzd2FwIChiLCBuLCBtKSB7XG4gIHZhciBpID0gYltuXVxuICBiW25dID0gYlttXVxuICBiW21dID0gaVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnN3YXAxNiA9IGZ1bmN0aW9uIHN3YXAxNiAoKSB7XG4gIHZhciBsZW4gPSB0aGlzLmxlbmd0aFxuICBpZiAobGVuICUgMiAhPT0gMCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgMTYtYml0cycpXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkgKz0gMikge1xuICAgIHN3YXAodGhpcywgaSwgaSArIDEpXG4gIH1cbiAgcmV0dXJuIHRoaXNcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5zd2FwMzIgPSBmdW5jdGlvbiBzd2FwMzIgKCkge1xuICB2YXIgbGVuID0gdGhpcy5sZW5ndGhcbiAgaWYgKGxlbiAlIDQgIT09IDApIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mIDMyLWJpdHMnKVxuICB9XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpICs9IDQpIHtcbiAgICBzd2FwKHRoaXMsIGksIGkgKyAzKVxuICAgIHN3YXAodGhpcywgaSArIDEsIGkgKyAyKVxuICB9XG4gIHJldHVybiB0aGlzXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUudG9TdHJpbmcgPSBmdW5jdGlvbiB0b1N0cmluZyAoKSB7XG4gIHZhciBsZW5ndGggPSB0aGlzLmxlbmd0aCB8IDBcbiAgaWYgKGxlbmd0aCA9PT0gMCkgcmV0dXJuICcnXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKSByZXR1cm4gdXRmOFNsaWNlKHRoaXMsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHNsb3dUb1N0cmluZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuZXF1YWxzID0gZnVuY3Rpb24gZXF1YWxzIChiKSB7XG4gIGlmICghQnVmZmVyLmlzQnVmZmVyKGIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyJylcbiAgaWYgKHRoaXMgPT09IGIpIHJldHVybiB0cnVlXG4gIHJldHVybiBCdWZmZXIuY29tcGFyZSh0aGlzLCBiKSA9PT0gMFxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluc3BlY3QgPSBmdW5jdGlvbiBpbnNwZWN0ICgpIHtcbiAgdmFyIHN0ciA9ICcnXG4gIHZhciBtYXggPSBleHBvcnRzLklOU1BFQ1RfTUFYX0JZVEVTXG4gIGlmICh0aGlzLmxlbmd0aCA+IDApIHtcbiAgICBzdHIgPSB0aGlzLnRvU3RyaW5nKCdoZXgnLCAwLCBtYXgpLm1hdGNoKC8uezJ9L2cpLmpvaW4oJyAnKVxuICAgIGlmICh0aGlzLmxlbmd0aCA+IG1heCkgc3RyICs9ICcgLi4uICdcbiAgfVxuICByZXR1cm4gJzxCdWZmZXIgJyArIHN0ciArICc+J1xufVxuXG5CdWZmZXIucHJvdG90eXBlLmNvbXBhcmUgPSBmdW5jdGlvbiBjb21wYXJlICh0YXJnZXQsIHN0YXJ0LCBlbmQsIHRoaXNTdGFydCwgdGhpc0VuZCkge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcih0YXJnZXQpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnQgbXVzdCBiZSBhIEJ1ZmZlcicpXG4gIH1cblxuICBpZiAoc3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHN0YXJ0ID0gMFxuICB9XG4gIGlmIChlbmQgPT09IHVuZGVmaW5lZCkge1xuICAgIGVuZCA9IHRhcmdldCA/IHRhcmdldC5sZW5ndGggOiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgdGhpc1N0YXJ0ID0gMFxuICB9XG4gIGlmICh0aGlzRW5kID09PSB1bmRlZmluZWQpIHtcbiAgICB0aGlzRW5kID0gdGhpcy5sZW5ndGhcbiAgfVxuXG4gIGlmIChzdGFydCA8IDAgfHwgZW5kID4gdGFyZ2V0Lmxlbmd0aCB8fCB0aGlzU3RhcnQgPCAwIHx8IHRoaXNFbmQgPiB0aGlzLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBSYW5nZUVycm9yKCdvdXQgb2YgcmFuZ2UgaW5kZXgnKVxuICB9XG5cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kICYmIHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAwXG4gIH1cbiAgaWYgKHRoaXNTdGFydCA+PSB0aGlzRW5kKSB7XG4gICAgcmV0dXJuIC0xXG4gIH1cbiAgaWYgKHN0YXJ0ID49IGVuZCkge1xuICAgIHJldHVybiAxXG4gIH1cblxuICBzdGFydCA+Pj49IDBcbiAgZW5kID4+Pj0gMFxuICB0aGlzU3RhcnQgPj4+PSAwXG4gIHRoaXNFbmQgPj4+PSAwXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCkgcmV0dXJuIDBcblxuICB2YXIgeCA9IHRoaXNFbmQgLSB0aGlzU3RhcnRcbiAgdmFyIHkgPSBlbmQgLSBzdGFydFxuICB2YXIgbGVuID0gTWF0aC5taW4oeCwgeSlcblxuICB2YXIgdGhpc0NvcHkgPSB0aGlzLnNsaWNlKHRoaXNTdGFydCwgdGhpc0VuZClcbiAgdmFyIHRhcmdldENvcHkgPSB0YXJnZXQuc2xpY2Uoc3RhcnQsIGVuZClcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKHRoaXNDb3B5W2ldICE9PSB0YXJnZXRDb3B5W2ldKSB7XG4gICAgICB4ID0gdGhpc0NvcHlbaV1cbiAgICAgIHkgPSB0YXJnZXRDb3B5W2ldXG4gICAgICBicmVha1xuICAgIH1cbiAgfVxuXG4gIGlmICh4IDwgeSkgcmV0dXJuIC0xXG4gIGlmICh5IDwgeCkgcmV0dXJuIDFcbiAgcmV0dXJuIDBcbn1cblxuZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpIHtcbiAgdmFyIGluZGV4U2l6ZSA9IDFcbiAgdmFyIGFyckxlbmd0aCA9IGFyci5sZW5ndGhcbiAgdmFyIHZhbExlbmd0aCA9IHZhbC5sZW5ndGhcblxuICBpZiAoZW5jb2RpbmcgIT09IHVuZGVmaW5lZCkge1xuICAgIGVuY29kaW5nID0gU3RyaW5nKGVuY29kaW5nKS50b0xvd2VyQ2FzZSgpXG4gICAgaWYgKGVuY29kaW5nID09PSAndWNzMicgfHwgZW5jb2RpbmcgPT09ICd1Y3MtMicgfHxcbiAgICAgICAgZW5jb2RpbmcgPT09ICd1dGYxNmxlJyB8fCBlbmNvZGluZyA9PT0gJ3V0Zi0xNmxlJykge1xuICAgICAgaWYgKGFyci5sZW5ndGggPCAyIHx8IHZhbC5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJldHVybiAtMVxuICAgICAgfVxuICAgICAgaW5kZXhTaXplID0gMlxuICAgICAgYXJyTGVuZ3RoIC89IDJcbiAgICAgIHZhbExlbmd0aCAvPSAyXG4gICAgICBieXRlT2Zmc2V0IC89IDJcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChidWYsIGkpIHtcbiAgICBpZiAoaW5kZXhTaXplID09PSAxKSB7XG4gICAgICByZXR1cm4gYnVmW2ldXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBidWYucmVhZFVJbnQxNkJFKGkgKiBpbmRleFNpemUpXG4gICAgfVxuICB9XG5cbiAgdmFyIGZvdW5kSW5kZXggPSAtMVxuICBmb3IgKHZhciBpID0gYnl0ZU9mZnNldDsgaSA8IGFyckxlbmd0aDsgKytpKSB7XG4gICAgaWYgKHJlYWQoYXJyLCBpKSA9PT0gcmVhZCh2YWwsIGZvdW5kSW5kZXggPT09IC0xID8gMCA6IGkgLSBmb3VuZEluZGV4KSkge1xuICAgICAgaWYgKGZvdW5kSW5kZXggPT09IC0xKSBmb3VuZEluZGV4ID0gaVxuICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsTGVuZ3RoKSByZXR1cm4gZm91bmRJbmRleCAqIGluZGV4U2l6ZVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoZm91bmRJbmRleCAhPT0gLTEpIGkgLT0gaSAtIGZvdW5kSW5kZXhcbiAgICAgIGZvdW5kSW5kZXggPSAtMVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiAtMVxufVxuXG5CdWZmZXIucHJvdG90eXBlLmluZGV4T2YgPSBmdW5jdGlvbiBpbmRleE9mICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIGlmICh0eXBlb2YgYnl0ZU9mZnNldCA9PT0gJ3N0cmluZycpIHtcbiAgICBlbmNvZGluZyA9IGJ5dGVPZmZzZXRcbiAgICBieXRlT2Zmc2V0ID0gMFxuICB9IGVsc2UgaWYgKGJ5dGVPZmZzZXQgPiAweDdmZmZmZmZmKSB7XG4gICAgYnl0ZU9mZnNldCA9IDB4N2ZmZmZmZmZcbiAgfSBlbHNlIGlmIChieXRlT2Zmc2V0IDwgLTB4ODAwMDAwMDApIHtcbiAgICBieXRlT2Zmc2V0ID0gLTB4ODAwMDAwMDBcbiAgfVxuICBieXRlT2Zmc2V0ID4+PSAwXG5cbiAgaWYgKHRoaXMubGVuZ3RoID09PSAwKSByZXR1cm4gLTFcbiAgaWYgKGJ5dGVPZmZzZXQgPj0gdGhpcy5sZW5ndGgpIHJldHVybiAtMVxuXG4gIC8vIE5lZ2F0aXZlIG9mZnNldHMgc3RhcnQgZnJvbSB0aGUgZW5kIG9mIHRoZSBidWZmZXJcbiAgaWYgKGJ5dGVPZmZzZXQgPCAwKSBieXRlT2Zmc2V0ID0gTWF0aC5tYXgodGhpcy5sZW5ndGggKyBieXRlT2Zmc2V0LCAwKVxuXG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIHZhbCA9IEJ1ZmZlci5mcm9tKHZhbCwgZW5jb2RpbmcpXG4gIH1cblxuICBpZiAoQnVmZmVyLmlzQnVmZmVyKHZhbCkpIHtcbiAgICAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZy9idWZmZXIgYWx3YXlzIGZhaWxzXG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiAtMVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIHZhbCwgYnl0ZU9mZnNldCwgZW5jb2RpbmcpXG4gIH1cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUICYmIFVpbnQ4QXJyYXkucHJvdG90eXBlLmluZGV4T2YgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICAgIH1cbiAgICByZXR1cm4gYXJyYXlJbmRleE9mKHRoaXMsIFsgdmFsIF0sIGJ5dGVPZmZzZXQsIGVuY29kaW5nKVxuICB9XG5cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcigndmFsIG11c3QgYmUgc3RyaW5nLCBudW1iZXIgb3IgQnVmZmVyJylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5pbmNsdWRlcyA9IGZ1bmN0aW9uIGluY2x1ZGVzICh2YWwsIGJ5dGVPZmZzZXQsIGVuY29kaW5nKSB7XG4gIHJldHVybiB0aGlzLmluZGV4T2YodmFsLCBieXRlT2Zmc2V0LCBlbmNvZGluZykgIT09IC0xXG59XG5cbmZ1bmN0aW9uIGhleFdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgb2Zmc2V0ID0gTnVtYmVyKG9mZnNldCkgfHwgMFxuICB2YXIgcmVtYWluaW5nID0gYnVmLmxlbmd0aCAtIG9mZnNldFxuICBpZiAoIWxlbmd0aCkge1xuICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICB9IGVsc2Uge1xuICAgIGxlbmd0aCA9IE51bWJlcihsZW5ndGgpXG4gICAgaWYgKGxlbmd0aCA+IHJlbWFpbmluZykge1xuICAgICAgbGVuZ3RoID0gcmVtYWluaW5nXG4gICAgfVxuICB9XG5cbiAgLy8gbXVzdCBiZSBhbiBldmVuIG51bWJlciBvZiBkaWdpdHNcbiAgdmFyIHN0ckxlbiA9IHN0cmluZy5sZW5ndGhcbiAgaWYgKHN0ckxlbiAlIDIgIT09IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcblxuICBpZiAobGVuZ3RoID4gc3RyTGVuIC8gMikge1xuICAgIGxlbmd0aCA9IHN0ckxlbiAvIDJcbiAgfVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgKytpKSB7XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlSW50KHN0cmluZy5zdWJzdHIoaSAqIDIsIDIpLCAxNilcbiAgICBpZiAoaXNOYU4ocGFyc2VkKSkgcmV0dXJuIGlcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAnQnVmZmVyLndyaXRlKHN0cmluZywgZW5jb2RpbmcsIG9mZnNldFssIGxlbmd0aF0pIGlzIG5vIGxvbmdlciBzdXBwb3J0ZWQnXG4gICAgKVxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgKytpKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyArK2kpIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyArK2kpIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignXCJidWZmZXJcIiBhcmd1bWVudCBtdXN0IGJlIGEgQnVmZmVyIGluc3RhbmNlJylcbiAgaWYgKHZhbHVlID4gbWF4IHx8IHZhbHVlIDwgbWluKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignXCJ2YWx1ZVwiIGFyZ3VtZW50IGlzIG91dCBvZiBib3VuZHMnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gYnVmLmxlbmd0aCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50QkUgPSBmdW5jdGlvbiB3cml0ZVVJbnRCRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBtYXhCeXRlcyA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSAtIDFcbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBtYXhCeXRlcywgMClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKHZhbHVlIC8gbXVsKSAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50OCA9IGZ1bmN0aW9uIHdyaXRlVUludDggKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMSwgMHhmZiwgMClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICByZXR1cm4gb2Zmc2V0ICsgMVxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQxNiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmYgKyB2YWx1ZSArIDFcbiAgZm9yICh2YXIgaSA9IDAsIGogPSBNYXRoLm1pbihidWYubGVuZ3RoIC0gb2Zmc2V0LCAyKTsgaSA8IGo7ICsraSkge1xuICAgIGJ1ZltvZmZzZXQgKyBpXSA9ICh2YWx1ZSAmICgweGZmIDw8ICg4ICogKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkpKSkgPj4+XG4gICAgICAobGl0dGxlRW5kaWFuID8gaSA6IDEgLSBpKSAqIDhcbiAgfVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZVVJbnQxNkxFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDIsIDB4ZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDE2KHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5mdW5jdGlvbiBvYmplY3RXcml0ZVVJbnQzMiAoYnVmLCB2YWx1ZSwgb2Zmc2V0LCBsaXR0bGVFbmRpYW4pIHtcbiAgaWYgKHZhbHVlIDwgMCkgdmFsdWUgPSAweGZmZmZmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgNCk7IGkgPCBqOyArK2kpIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgPj4+IChsaXR0bGVFbmRpYW4gPyBpIDogMyAtIGkpICogOCkgJiAweGZmXG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlID4+PiAyNClcbiAgICB0aGlzW29mZnNldCArIDJdID0gKHZhbHVlID4+PiAxNilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZVVJbnQzMkJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDQsIDB4ZmZmZmZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDNdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQzMih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgNFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50TEUgPSBmdW5jdGlvbiB3cml0ZUludExFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gMFxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gMFxuICB0aGlzW29mZnNldF0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgLSAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50QkUgPSBmdW5jdGlvbiB3cml0ZUludEJFICh2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIHtcbiAgICB2YXIgbGltaXQgPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aCAtIDEpXG5cbiAgICBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBieXRlTGVuZ3RoLCBsaW1pdCAtIDEsIC1saW1pdClcbiAgfVxuXG4gIHZhciBpID0gYnl0ZUxlbmd0aCAtIDFcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICBpZiAodmFsdWUgPCAwICYmIHN1YiA9PT0gMCAmJiB0aGlzW29mZnNldCArIGkgKyAxXSAhPT0gMCkge1xuICAgICAgc3ViID0gMVxuICAgIH1cbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdJbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyAtLWkpIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47ICsraSkge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gVXNhZ2U6XG4vLyAgICBidWZmZXIuZmlsbChudW1iZXJbLCBvZmZzZXRbLCBlbmRdXSlcbi8vICAgIGJ1ZmZlci5maWxsKGJ1ZmZlclssIG9mZnNldFssIGVuZF1dKVxuLy8gICAgYnVmZmVyLmZpbGwoc3RyaW5nWywgb2Zmc2V0WywgZW5kXV1bLCBlbmNvZGluZ10pXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWwsIHN0YXJ0LCBlbmQsIGVuY29kaW5nKSB7XG4gIC8vIEhhbmRsZSBzdHJpbmcgY2FzZXM6XG4gIGlmICh0eXBlb2YgdmFsID09PSAnc3RyaW5nJykge1xuICAgIGlmICh0eXBlb2Ygc3RhcnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBlbmNvZGluZyA9IHN0YXJ0XG4gICAgICBzdGFydCA9IDBcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgZW5kID09PSAnc3RyaW5nJykge1xuICAgICAgZW5jb2RpbmcgPSBlbmRcbiAgICAgIGVuZCA9IHRoaXMubGVuZ3RoXG4gICAgfVxuICAgIGlmICh2YWwubGVuZ3RoID09PSAxKSB7XG4gICAgICB2YXIgY29kZSA9IHZhbC5jaGFyQ29kZUF0KDApXG4gICAgICBpZiAoY29kZSA8IDI1Nikge1xuICAgICAgICB2YWwgPSBjb2RlXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChlbmNvZGluZyAhPT0gdW5kZWZpbmVkICYmIHR5cGVvZiBlbmNvZGluZyAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2VuY29kaW5nIG11c3QgYmUgYSBzdHJpbmcnKVxuICAgIH1cbiAgICBpZiAodHlwZW9mIGVuY29kaW5nID09PSAnc3RyaW5nJyAmJiAhQnVmZmVyLmlzRW5jb2RpbmcoZW5jb2RpbmcpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdVbmtub3duIGVuY29kaW5nOiAnICsgZW5jb2RpbmcpXG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgdmFsID0gdmFsICYgMjU1XG4gIH1cblxuICAvLyBJbnZhbGlkIHJhbmdlcyBhcmUgbm90IHNldCB0byBhIGRlZmF1bHQsIHNvIGNhbiByYW5nZSBjaGVjayBlYXJseS5cbiAgaWYgKHN0YXJ0IDwgMCB8fCB0aGlzLmxlbmd0aCA8IHN0YXJ0IHx8IHRoaXMubGVuZ3RoIDwgZW5kKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ091dCBvZiByYW5nZSBpbmRleCcpXG4gIH1cblxuICBpZiAoZW5kIDw9IHN0YXJ0KSB7XG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIHN0YXJ0ID0gc3RhcnQgPj4+IDBcbiAgZW5kID0gZW5kID09PSB1bmRlZmluZWQgPyB0aGlzLmxlbmd0aCA6IGVuZCA+Pj4gMFxuXG4gIGlmICghdmFsKSB2YWwgPSAwXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdudW1iZXInKSB7XG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7ICsraSkge1xuICAgICAgdGhpc1tpXSA9IHZhbFxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICB2YXIgYnl0ZXMgPSBCdWZmZXIuaXNCdWZmZXIodmFsKVxuICAgICAgPyB2YWxcbiAgICAgIDogdXRmOFRvQnl0ZXMobmV3IEJ1ZmZlcih2YWwsIGVuY29kaW5nKS50b1N0cmluZygpKVxuICAgIHZhciBsZW4gPSBieXRlcy5sZW5ndGhcbiAgICBmb3IgKGkgPSAwOyBpIDwgZW5kIC0gc3RhcnQ7ICsraSkge1xuICAgICAgdGhpc1tpICsgc3RhcnRdID0gYnl0ZXNbaSAlIGxlbl1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpc1xufVxuXG4vLyBIRUxQRVIgRlVOQ1RJT05TXG4vLyA9PT09PT09PT09PT09PT09XG5cbnZhciBJTlZBTElEX0JBU0U2NF9SRSA9IC9bXitcXC8wLTlBLVphLXotX10vZ1xuXG5mdW5jdGlvbiBiYXNlNjRjbGVhbiAoc3RyKSB7XG4gIC8vIE5vZGUgc3RyaXBzIG91dCBpbnZhbGlkIGNoYXJhY3RlcnMgbGlrZSBcXG4gYW5kIFxcdCBmcm9tIHRoZSBzdHJpbmcsIGJhc2U2NC1qcyBkb2VzIG5vdFxuICBzdHIgPSBzdHJpbmd0cmltKHN0cikucmVwbGFjZShJTlZBTElEX0JBU0U2NF9SRSwgJycpXG4gIC8vIE5vZGUgY29udmVydHMgc3RyaW5ncyB3aXRoIGxlbmd0aCA8IDIgdG8gJydcbiAgaWYgKHN0ci5sZW5ndGggPCAyKSByZXR1cm4gJydcbiAgLy8gTm9kZSBhbGxvd3MgZm9yIG5vbi1wYWRkZWQgYmFzZTY0IHN0cmluZ3MgKG1pc3NpbmcgdHJhaWxpbmcgPT09KSwgYmFzZTY0LWpzIGRvZXMgbm90XG4gIHdoaWxlIChzdHIubGVuZ3RoICUgNCAhPT0gMCkge1xuICAgIHN0ciA9IHN0ciArICc9J1xuICB9XG4gIHJldHVybiBzdHJcbn1cblxuZnVuY3Rpb24gc3RyaW5ndHJpbSAoc3RyKSB7XG4gIGlmIChzdHIudHJpbSkgcmV0dXJuIHN0ci50cmltKClcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzK3xcXHMrJC9nLCAnJylcbn1cblxuZnVuY3Rpb24gdG9IZXggKG4pIHtcbiAgaWYgKG4gPCAxNikgcmV0dXJuICcwJyArIG4udG9TdHJpbmcoMTYpXG4gIHJldHVybiBuLnRvU3RyaW5nKDE2KVxufVxuXG5mdW5jdGlvbiB1dGY4VG9CeXRlcyAoc3RyaW5nLCB1bml0cykge1xuICB1bml0cyA9IHVuaXRzIHx8IEluZmluaXR5XG4gIHZhciBjb2RlUG9pbnRcbiAgdmFyIGxlbmd0aCA9IHN0cmluZy5sZW5ndGhcbiAgdmFyIGxlYWRTdXJyb2dhdGUgPSBudWxsXG4gIHZhciBieXRlcyA9IFtdXG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGNvZGVQb2ludCA9IHN0cmluZy5jaGFyQ29kZUF0KGkpXG5cbiAgICAvLyBpcyBzdXJyb2dhdGUgY29tcG9uZW50XG4gICAgaWYgKGNvZGVQb2ludCA+IDB4RDdGRiAmJiBjb2RlUG9pbnQgPCAweEUwMDApIHtcbiAgICAgIC8vIGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoIWxlYWRTdXJyb2dhdGUpIHtcbiAgICAgICAgLy8gbm8gbGVhZCB5ZXRcbiAgICAgICAgaWYgKGNvZGVQb2ludCA+IDB4REJGRikge1xuICAgICAgICAgIC8vIHVuZXhwZWN0ZWQgdHJhaWxcbiAgICAgICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGkgKyAxID09PSBsZW5ndGgpIHtcbiAgICAgICAgICAvLyB1bnBhaXJlZCBsZWFkXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHZhbGlkIGxlYWRcbiAgICAgICAgbGVhZFN1cnJvZ2F0ZSA9IGNvZGVQb2ludFxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIDIgbGVhZHMgaW4gYSByb3dcbiAgICAgIGlmIChjb2RlUG9pbnQgPCAweERDMDApIHtcbiAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgLy8gdmFsaWQgc3Vycm9nYXRlIHBhaXJcbiAgICAgIGNvZGVQb2ludCA9IChsZWFkU3Vycm9nYXRlIC0gMHhEODAwIDw8IDEwIHwgY29kZVBvaW50IC0gMHhEQzAwKSArIDB4MTAwMDBcbiAgICB9IGVsc2UgaWYgKGxlYWRTdXJyb2dhdGUpIHtcbiAgICAgIC8vIHZhbGlkIGJtcCBjaGFyLCBidXQgbGFzdCBjaGFyIHdhcyBhIGxlYWRcbiAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgIH1cblxuICAgIGxlYWRTdXJyb2dhdGUgPSBudWxsXG5cbiAgICAvLyBlbmNvZGUgdXRmOFxuICAgIGlmIChjb2RlUG9pbnQgPCAweDgwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDEpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goY29kZVBvaW50KVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHg4MDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiB8IDB4QzAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDEwMDAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDMpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgfCAweEUwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHg2ICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCAmIDB4M0YgfCAweDgwXG4gICAgICApXG4gICAgfSBlbHNlIGlmIChjb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSA0KSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHgxMiB8IDB4RjAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweEMgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29kZSBwb2ludCcpXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpVG9CeXRlcyAoc3RyKSB7XG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7ICsraSkge1xuICAgIC8vIE5vZGUncyBjb2RlIHNlZW1zIHRvIGJlIGRvaW5nIHRoaXMgYW5kIG5vdCAmIDB4N0YuLlxuICAgIGJ5dGVBcnJheS5wdXNoKHN0ci5jaGFyQ29kZUF0KGkpICYgMHhGRilcbiAgfVxuICByZXR1cm4gYnl0ZUFycmF5XG59XG5cbmZ1bmN0aW9uIHV0ZjE2bGVUb0J5dGVzIChzdHIsIHVuaXRzKSB7XG4gIHZhciBjLCBoaSwgbG9cbiAgdmFyIGJ5dGVBcnJheSA9IFtdXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgKytpKSB7XG4gICAgaWYgKCh1bml0cyAtPSAyKSA8IDApIGJyZWFrXG5cbiAgICBjID0gc3RyLmNoYXJDb2RlQXQoaSlcbiAgICBoaSA9IGMgPj4gOFxuICAgIGxvID0gYyAlIDI1NlxuICAgIGJ5dGVBcnJheS5wdXNoKGxvKVxuICAgIGJ5dGVBcnJheS5wdXNoKGhpKVxuICB9XG5cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiBiYXNlNjRUb0J5dGVzIChzdHIpIHtcbiAgcmV0dXJuIGJhc2U2NC50b0J5dGVBcnJheShiYXNlNjRjbGVhbihzdHIpKVxufVxuXG5mdW5jdGlvbiBibGl0QnVmZmVyIChzcmMsIGRzdCwgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7ICsraSkge1xuICAgIGlmICgoaSArIG9mZnNldCA+PSBkc3QubGVuZ3RoKSB8fCAoaSA+PSBzcmMubGVuZ3RoKSkgYnJlYWtcbiAgICBkc3RbaSArIG9mZnNldF0gPSBzcmNbaV1cbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiBpc25hbiAodmFsKSB7XG4gIHJldHVybiB2YWwgIT09IHZhbCAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXNlbGYtY29tcGFyZVxufVxuIiwidmFyIHRvU3RyaW5nID0ge30udG9TdHJpbmc7XG5cbm1vZHVsZS5leHBvcnRzID0gQXJyYXkuaXNBcnJheSB8fCBmdW5jdGlvbiAoYXJyKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCJ2YXIgY2xvbmUgPSAoZnVuY3Rpb24oKSB7XG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ2xvbmVzIChjb3BpZXMpIGFuIE9iamVjdCB1c2luZyBkZWVwIGNvcHlpbmcuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBzdXBwb3J0cyBjaXJjdWxhciByZWZlcmVuY2VzIGJ5IGRlZmF1bHQsIGJ1dCBpZiB5b3UgYXJlIGNlcnRhaW5cbiAqIHRoZXJlIGFyZSBubyBjaXJjdWxhciByZWZlcmVuY2VzIGluIHlvdXIgb2JqZWN0LCB5b3UgY2FuIHNhdmUgc29tZSBDUFUgdGltZVxuICogYnkgY2FsbGluZyBjbG9uZShvYmosIGZhbHNlKS5cbiAqXG4gKiBDYXV0aW9uOiBpZiBgY2lyY3VsYXJgIGlzIGZhbHNlIGFuZCBgcGFyZW50YCBjb250YWlucyBjaXJjdWxhciByZWZlcmVuY2VzLFxuICogeW91ciBwcm9ncmFtIG1heSBlbnRlciBhbiBpbmZpbml0ZSBsb29wIGFuZCBjcmFzaC5cbiAqXG4gKiBAcGFyYW0gYHBhcmVudGAgLSB0aGUgb2JqZWN0IHRvIGJlIGNsb25lZFxuICogQHBhcmFtIGBjaXJjdWxhcmAgLSBzZXQgdG8gdHJ1ZSBpZiB0aGUgb2JqZWN0IHRvIGJlIGNsb25lZCBtYXkgY29udGFpblxuICogICAgY2lyY3VsYXIgcmVmZXJlbmNlcy4gKG9wdGlvbmFsIC0gdHJ1ZSBieSBkZWZhdWx0KVxuICogQHBhcmFtIGBkZXB0aGAgLSBzZXQgdG8gYSBudW1iZXIgaWYgdGhlIG9iamVjdCBpcyBvbmx5IHRvIGJlIGNsb25lZCB0b1xuICogICAgYSBwYXJ0aWN1bGFyIGRlcHRoLiAob3B0aW9uYWwgLSBkZWZhdWx0cyB0byBJbmZpbml0eSlcbiAqIEBwYXJhbSBgcHJvdG90eXBlYCAtIHNldHMgdGhlIHByb3RvdHlwZSB0byBiZSB1c2VkIHdoZW4gY2xvbmluZyBhbiBvYmplY3QuXG4gKiAgICAob3B0aW9uYWwgLSBkZWZhdWx0cyB0byBwYXJlbnQgcHJvdG90eXBlKS5cbiovXG5mdW5jdGlvbiBjbG9uZShwYXJlbnQsIGNpcmN1bGFyLCBkZXB0aCwgcHJvdG90eXBlKSB7XG4gIHZhciBmaWx0ZXI7XG4gIGlmICh0eXBlb2YgY2lyY3VsYXIgPT09ICdvYmplY3QnKSB7XG4gICAgZGVwdGggPSBjaXJjdWxhci5kZXB0aDtcbiAgICBwcm90b3R5cGUgPSBjaXJjdWxhci5wcm90b3R5cGU7XG4gICAgZmlsdGVyID0gY2lyY3VsYXIuZmlsdGVyO1xuICAgIGNpcmN1bGFyID0gY2lyY3VsYXIuY2lyY3VsYXJcbiAgfVxuICAvLyBtYWludGFpbiB0d28gYXJyYXlzIGZvciBjaXJjdWxhciByZWZlcmVuY2VzLCB3aGVyZSBjb3JyZXNwb25kaW5nIHBhcmVudHNcbiAgLy8gYW5kIGNoaWxkcmVuIGhhdmUgdGhlIHNhbWUgaW5kZXhcbiAgdmFyIGFsbFBhcmVudHMgPSBbXTtcbiAgdmFyIGFsbENoaWxkcmVuID0gW107XG5cbiAgdmFyIHVzZUJ1ZmZlciA9IHR5cGVvZiBCdWZmZXIgIT0gJ3VuZGVmaW5lZCc7XG5cbiAgaWYgKHR5cGVvZiBjaXJjdWxhciA9PSAndW5kZWZpbmVkJylcbiAgICBjaXJjdWxhciA9IHRydWU7XG5cbiAgaWYgKHR5cGVvZiBkZXB0aCA9PSAndW5kZWZpbmVkJylcbiAgICBkZXB0aCA9IEluZmluaXR5O1xuXG4gIC8vIHJlY3Vyc2UgdGhpcyBmdW5jdGlvbiBzbyB3ZSBkb24ndCByZXNldCBhbGxQYXJlbnRzIGFuZCBhbGxDaGlsZHJlblxuICBmdW5jdGlvbiBfY2xvbmUocGFyZW50LCBkZXB0aCkge1xuICAgIC8vIGNsb25pbmcgbnVsbCBhbHdheXMgcmV0dXJucyBudWxsXG4gICAgaWYgKHBhcmVudCA9PT0gbnVsbClcbiAgICAgIHJldHVybiBudWxsO1xuXG4gICAgaWYgKGRlcHRoID09IDApXG4gICAgICByZXR1cm4gcGFyZW50O1xuXG4gICAgdmFyIGNoaWxkO1xuICAgIHZhciBwcm90bztcbiAgICBpZiAodHlwZW9mIHBhcmVudCAhPSAnb2JqZWN0Jykge1xuICAgICAgcmV0dXJuIHBhcmVudDtcbiAgICB9XG5cbiAgICBpZiAoY2xvbmUuX19pc0FycmF5KHBhcmVudCkpIHtcbiAgICAgIGNoaWxkID0gW107XG4gICAgfSBlbHNlIGlmIChjbG9uZS5fX2lzUmVnRXhwKHBhcmVudCkpIHtcbiAgICAgIGNoaWxkID0gbmV3IFJlZ0V4cChwYXJlbnQuc291cmNlLCBfX2dldFJlZ0V4cEZsYWdzKHBhcmVudCkpO1xuICAgICAgaWYgKHBhcmVudC5sYXN0SW5kZXgpIGNoaWxkLmxhc3RJbmRleCA9IHBhcmVudC5sYXN0SW5kZXg7XG4gICAgfSBlbHNlIGlmIChjbG9uZS5fX2lzRGF0ZShwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IG5ldyBEYXRlKHBhcmVudC5nZXRUaW1lKCkpO1xuICAgIH0gZWxzZSBpZiAodXNlQnVmZmVyICYmIEJ1ZmZlci5pc0J1ZmZlcihwYXJlbnQpKSB7XG4gICAgICBjaGlsZCA9IG5ldyBCdWZmZXIocGFyZW50Lmxlbmd0aCk7XG4gICAgICBwYXJlbnQuY29weShjaGlsZCk7XG4gICAgICByZXR1cm4gY2hpbGQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmICh0eXBlb2YgcHJvdG90eXBlID09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHByb3RvID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKHBhcmVudCk7XG4gICAgICAgIGNoaWxkID0gT2JqZWN0LmNyZWF0ZShwcm90byk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgY2hpbGQgPSBPYmplY3QuY3JlYXRlKHByb3RvdHlwZSk7XG4gICAgICAgIHByb3RvID0gcHJvdG90eXBlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjaXJjdWxhcikge1xuICAgICAgdmFyIGluZGV4ID0gYWxsUGFyZW50cy5pbmRleE9mKHBhcmVudCk7XG5cbiAgICAgIGlmIChpbmRleCAhPSAtMSkge1xuICAgICAgICByZXR1cm4gYWxsQ2hpbGRyZW5baW5kZXhdO1xuICAgICAgfVxuICAgICAgYWxsUGFyZW50cy5wdXNoKHBhcmVudCk7XG4gICAgICBhbGxDaGlsZHJlbi5wdXNoKGNoaWxkKTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpIGluIHBhcmVudCkge1xuICAgICAgdmFyIGF0dHJzO1xuICAgICAgaWYgKHByb3RvKSB7XG4gICAgICAgIGF0dHJzID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihwcm90bywgaSk7XG4gICAgICB9XG5cbiAgICAgIGlmIChhdHRycyAmJiBhdHRycy5zZXQgPT0gbnVsbCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGNoaWxkW2ldID0gX2Nsb25lKHBhcmVudFtpXSwgZGVwdGggLSAxKTtcbiAgICB9XG5cbiAgICByZXR1cm4gY2hpbGQ7XG4gIH1cblxuICByZXR1cm4gX2Nsb25lKHBhcmVudCwgZGVwdGgpO1xufVxuXG4vKipcbiAqIFNpbXBsZSBmbGF0IGNsb25lIHVzaW5nIHByb3RvdHlwZSwgYWNjZXB0cyBvbmx5IG9iamVjdHMsIHVzZWZ1bGwgZm9yIHByb3BlcnR5XG4gKiBvdmVycmlkZSBvbiBGTEFUIGNvbmZpZ3VyYXRpb24gb2JqZWN0IChubyBuZXN0ZWQgcHJvcHMpLlxuICpcbiAqIFVTRSBXSVRIIENBVVRJT04hIFRoaXMgbWF5IG5vdCBiZWhhdmUgYXMgeW91IHdpc2ggaWYgeW91IGRvIG5vdCBrbm93IGhvdyB0aGlzXG4gKiB3b3Jrcy5cbiAqL1xuY2xvbmUuY2xvbmVQcm90b3R5cGUgPSBmdW5jdGlvbiBjbG9uZVByb3RvdHlwZShwYXJlbnQpIHtcbiAgaWYgKHBhcmVudCA9PT0gbnVsbClcbiAgICByZXR1cm4gbnVsbDtcblxuICB2YXIgYyA9IGZ1bmN0aW9uICgpIHt9O1xuICBjLnByb3RvdHlwZSA9IHBhcmVudDtcbiAgcmV0dXJuIG5ldyBjKCk7XG59O1xuXG4vLyBwcml2YXRlIHV0aWxpdHkgZnVuY3Rpb25zXG5cbmZ1bmN0aW9uIF9fb2JqVG9TdHIobykge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pO1xufTtcbmNsb25lLl9fb2JqVG9TdHIgPSBfX29ialRvU3RyO1xuXG5mdW5jdGlvbiBfX2lzRGF0ZShvKSB7XG4gIHJldHVybiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgJiYgX19vYmpUb1N0cihvKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufTtcbmNsb25lLl9faXNEYXRlID0gX19pc0RhdGU7XG5cbmZ1bmN0aW9uIF9faXNBcnJheShvKSB7XG4gIHJldHVybiB0eXBlb2YgbyA9PT0gJ29iamVjdCcgJiYgX19vYmpUb1N0cihvKSA9PT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG5jbG9uZS5fX2lzQXJyYXkgPSBfX2lzQXJyYXk7XG5cbmZ1bmN0aW9uIF9faXNSZWdFeHAobykge1xuICByZXR1cm4gdHlwZW9mIG8gPT09ICdvYmplY3QnICYmIF9fb2JqVG9TdHIobykgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufTtcbmNsb25lLl9faXNSZWdFeHAgPSBfX2lzUmVnRXhwO1xuXG5mdW5jdGlvbiBfX2dldFJlZ0V4cEZsYWdzKHJlKSB7XG4gIHZhciBmbGFncyA9ICcnO1xuICBpZiAocmUuZ2xvYmFsKSBmbGFncyArPSAnZyc7XG4gIGlmIChyZS5pZ25vcmVDYXNlKSBmbGFncyArPSAnaSc7XG4gIGlmIChyZS5tdWx0aWxpbmUpIGZsYWdzICs9ICdtJztcbiAgcmV0dXJuIGZsYWdzO1xufTtcbmNsb25lLl9fZ2V0UmVnRXhwRmxhZ3MgPSBfX2dldFJlZ0V4cEZsYWdzO1xuXG5yZXR1cm4gY2xvbmU7XG59KSgpO1xuXG5pZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBjbG9uZTtcbn1cbiIsIi8qIE1JVCBsaWNlbnNlICovXG52YXIgY3NzS2V5d29yZHMgPSByZXF1aXJlKCcuL2Nzcy1rZXl3b3JkcycpO1xuXG4vLyBOT1RFOiBjb252ZXJzaW9ucyBzaG91bGQgb25seSByZXR1cm4gcHJpbWl0aXZlIHZhbHVlcyAoaS5lLiBhcnJheXMsIG9yXG4vLyAgICAgICB2YWx1ZXMgdGhhdCBnaXZlIGNvcnJlY3QgYHR5cGVvZmAgcmVzdWx0cykuXG4vLyAgICAgICBkbyBub3QgdXNlIGJveCB2YWx1ZXMgdHlwZXMgKGkuZS4gTnVtYmVyKCksIFN0cmluZygpLCBldGMuKVxuXG52YXIgcmV2ZXJzZUtleXdvcmRzID0ge307XG5mb3IgKHZhciBrZXkgaW4gY3NzS2V5d29yZHMpIHtcblx0aWYgKGNzc0tleXdvcmRzLmhhc093blByb3BlcnR5KGtleSkpIHtcblx0XHRyZXZlcnNlS2V5d29yZHNbY3NzS2V5d29yZHNba2V5XS5qb2luKCldID0ga2V5O1xuXHR9XG59XG5cbnZhciBjb252ZXJ0ID0gbW9kdWxlLmV4cG9ydHMgPSB7XG5cdHJnYjoge2NoYW5uZWxzOiAzfSxcblx0aHNsOiB7Y2hhbm5lbHM6IDN9LFxuXHRoc3Y6IHtjaGFubmVsczogM30sXG5cdGh3Yjoge2NoYW5uZWxzOiAzfSxcblx0Y215azoge2NoYW5uZWxzOiA0fSxcblx0eHl6OiB7Y2hhbm5lbHM6IDN9LFxuXHRsYWI6IHtjaGFubmVsczogM30sXG5cdGxjaDoge2NoYW5uZWxzOiAzfSxcblx0aGV4OiB7Y2hhbm5lbHM6IDF9LFxuXHRrZXl3b3JkOiB7Y2hhbm5lbHM6IDF9LFxuXHRhbnNpMTY6IHtjaGFubmVsczogMX0sXG5cdGFuc2kyNTY6IHtjaGFubmVsczogMX0sXG5cdGhjZzoge2NoYW5uZWxzOiAzfSxcblx0YXBwbGU6IHtjaGFubmVsczogM31cbn07XG5cbi8vIGhpZGUgLmNoYW5uZWxzIHByb3BlcnR5XG5mb3IgKHZhciBtb2RlbCBpbiBjb252ZXJ0KSB7XG5cdGlmIChjb252ZXJ0Lmhhc093blByb3BlcnR5KG1vZGVsKSkge1xuXHRcdGlmICghKCdjaGFubmVscycgaW4gY29udmVydFttb2RlbF0pKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ21pc3NpbmcgY2hhbm5lbHMgcHJvcGVydHk6ICcgKyBtb2RlbCk7XG5cdFx0fVxuXG5cdFx0dmFyIGNoYW5uZWxzID0gY29udmVydFttb2RlbF0uY2hhbm5lbHM7XG5cdFx0ZGVsZXRlIGNvbnZlcnRbbW9kZWxdLmNoYW5uZWxzO1xuXHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb252ZXJ0W21vZGVsXSwgJ2NoYW5uZWxzJywge3ZhbHVlOiBjaGFubmVsc30pO1xuXHR9XG59XG5cbmNvbnZlcnQucmdiLmhzbCA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0dmFyIHIgPSByZ2JbMF0gLyAyNTU7XG5cdHZhciBnID0gcmdiWzFdIC8gMjU1O1xuXHR2YXIgYiA9IHJnYlsyXSAvIDI1NTtcblx0dmFyIG1pbiA9IE1hdGgubWluKHIsIGcsIGIpO1xuXHR2YXIgbWF4ID0gTWF0aC5tYXgociwgZywgYik7XG5cdHZhciBkZWx0YSA9IG1heCAtIG1pbjtcblx0dmFyIGg7XG5cdHZhciBzO1xuXHR2YXIgbDtcblxuXHRpZiAobWF4ID09PSBtaW4pIHtcblx0XHRoID0gMDtcblx0fSBlbHNlIGlmIChyID09PSBtYXgpIHtcblx0XHRoID0gKGcgLSBiKSAvIGRlbHRhO1xuXHR9IGVsc2UgaWYgKGcgPT09IG1heCkge1xuXHRcdGggPSAyICsgKGIgLSByKSAvIGRlbHRhO1xuXHR9IGVsc2UgaWYgKGIgPT09IG1heCkge1xuXHRcdGggPSA0ICsgKHIgLSBnKSAvIGRlbHRhO1xuXHR9XG5cblx0aCA9IE1hdGgubWluKGggKiA2MCwgMzYwKTtcblxuXHRpZiAoaCA8IDApIHtcblx0XHRoICs9IDM2MDtcblx0fVxuXG5cdGwgPSAobWluICsgbWF4KSAvIDI7XG5cblx0aWYgKG1heCA9PT0gbWluKSB7XG5cdFx0cyA9IDA7XG5cdH0gZWxzZSBpZiAobCA8PSAwLjUpIHtcblx0XHRzID0gZGVsdGEgLyAobWF4ICsgbWluKTtcblx0fSBlbHNlIHtcblx0XHRzID0gZGVsdGEgLyAoMiAtIG1heCAtIG1pbik7XG5cdH1cblxuXHRyZXR1cm4gW2gsIHMgKiAxMDAsIGwgKiAxMDBdO1xufTtcblxuY29udmVydC5yZ2IuaHN2ID0gZnVuY3Rpb24gKHJnYikge1xuXHR2YXIgciA9IHJnYlswXTtcblx0dmFyIGcgPSByZ2JbMV07XG5cdHZhciBiID0gcmdiWzJdO1xuXHR2YXIgbWluID0gTWF0aC5taW4ociwgZywgYik7XG5cdHZhciBtYXggPSBNYXRoLm1heChyLCBnLCBiKTtcblx0dmFyIGRlbHRhID0gbWF4IC0gbWluO1xuXHR2YXIgaDtcblx0dmFyIHM7XG5cdHZhciB2O1xuXG5cdGlmIChtYXggPT09IDApIHtcblx0XHRzID0gMDtcblx0fSBlbHNlIHtcblx0XHRzID0gKGRlbHRhIC8gbWF4ICogMTAwMCkgLyAxMDtcblx0fVxuXG5cdGlmIChtYXggPT09IG1pbikge1xuXHRcdGggPSAwO1xuXHR9IGVsc2UgaWYgKHIgPT09IG1heCkge1xuXHRcdGggPSAoZyAtIGIpIC8gZGVsdGE7XG5cdH0gZWxzZSBpZiAoZyA9PT0gbWF4KSB7XG5cdFx0aCA9IDIgKyAoYiAtIHIpIC8gZGVsdGE7XG5cdH0gZWxzZSBpZiAoYiA9PT0gbWF4KSB7XG5cdFx0aCA9IDQgKyAociAtIGcpIC8gZGVsdGE7XG5cdH1cblxuXHRoID0gTWF0aC5taW4oaCAqIDYwLCAzNjApO1xuXG5cdGlmIChoIDwgMCkge1xuXHRcdGggKz0gMzYwO1xuXHR9XG5cblx0diA9ICgobWF4IC8gMjU1KSAqIDEwMDApIC8gMTA7XG5cblx0cmV0dXJuIFtoLCBzLCB2XTtcbn07XG5cbmNvbnZlcnQucmdiLmh3YiA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0dmFyIHIgPSByZ2JbMF07XG5cdHZhciBnID0gcmdiWzFdO1xuXHR2YXIgYiA9IHJnYlsyXTtcblx0dmFyIGggPSBjb252ZXJ0LnJnYi5oc2wocmdiKVswXTtcblx0dmFyIHcgPSAxIC8gMjU1ICogTWF0aC5taW4ociwgTWF0aC5taW4oZywgYikpO1xuXG5cdGIgPSAxIC0gMSAvIDI1NSAqIE1hdGgubWF4KHIsIE1hdGgubWF4KGcsIGIpKTtcblxuXHRyZXR1cm4gW2gsIHcgKiAxMDAsIGIgKiAxMDBdO1xufTtcblxuY29udmVydC5yZ2IuY215ayA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0dmFyIHIgPSByZ2JbMF0gLyAyNTU7XG5cdHZhciBnID0gcmdiWzFdIC8gMjU1O1xuXHR2YXIgYiA9IHJnYlsyXSAvIDI1NTtcblx0dmFyIGM7XG5cdHZhciBtO1xuXHR2YXIgeTtcblx0dmFyIGs7XG5cblx0ayA9IE1hdGgubWluKDEgLSByLCAxIC0gZywgMSAtIGIpO1xuXHRjID0gKDEgLSByIC0gaykgLyAoMSAtIGspIHx8IDA7XG5cdG0gPSAoMSAtIGcgLSBrKSAvICgxIC0gaykgfHwgMDtcblx0eSA9ICgxIC0gYiAtIGspIC8gKDEgLSBrKSB8fCAwO1xuXG5cdHJldHVybiBbYyAqIDEwMCwgbSAqIDEwMCwgeSAqIDEwMCwgayAqIDEwMF07XG59O1xuXG5jb252ZXJ0LnJnYi5rZXl3b3JkID0gZnVuY3Rpb24gKHJnYikge1xuXHRyZXR1cm4gcmV2ZXJzZUtleXdvcmRzW3JnYi5qb2luKCldO1xufTtcblxuY29udmVydC5rZXl3b3JkLnJnYiA9IGZ1bmN0aW9uIChrZXl3b3JkKSB7XG5cdHJldHVybiBjc3NLZXl3b3Jkc1trZXl3b3JkXTtcbn07XG5cbmNvbnZlcnQucmdiLnh5eiA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0dmFyIHIgPSByZ2JbMF0gLyAyNTU7XG5cdHZhciBnID0gcmdiWzFdIC8gMjU1O1xuXHR2YXIgYiA9IHJnYlsyXSAvIDI1NTtcblxuXHQvLyBhc3N1bWUgc1JHQlxuXHRyID0gciA+IDAuMDQwNDUgPyBNYXRoLnBvdygoKHIgKyAwLjA1NSkgLyAxLjA1NSksIDIuNCkgOiAociAvIDEyLjkyKTtcblx0ZyA9IGcgPiAwLjA0MDQ1ID8gTWF0aC5wb3coKChnICsgMC4wNTUpIC8gMS4wNTUpLCAyLjQpIDogKGcgLyAxMi45Mik7XG5cdGIgPSBiID4gMC4wNDA0NSA/IE1hdGgucG93KCgoYiArIDAuMDU1KSAvIDEuMDU1KSwgMi40KSA6IChiIC8gMTIuOTIpO1xuXG5cdHZhciB4ID0gKHIgKiAwLjQxMjQpICsgKGcgKiAwLjM1NzYpICsgKGIgKiAwLjE4MDUpO1xuXHR2YXIgeSA9IChyICogMC4yMTI2KSArIChnICogMC43MTUyKSArIChiICogMC4wNzIyKTtcblx0dmFyIHogPSAociAqIDAuMDE5MykgKyAoZyAqIDAuMTE5MikgKyAoYiAqIDAuOTUwNSk7XG5cblx0cmV0dXJuIFt4ICogMTAwLCB5ICogMTAwLCB6ICogMTAwXTtcbn07XG5cbmNvbnZlcnQucmdiLmxhYiA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0dmFyIHh5eiA9IGNvbnZlcnQucmdiLnh5eihyZ2IpO1xuXHR2YXIgeCA9IHh5elswXTtcblx0dmFyIHkgPSB4eXpbMV07XG5cdHZhciB6ID0geHl6WzJdO1xuXHR2YXIgbDtcblx0dmFyIGE7XG5cdHZhciBiO1xuXG5cdHggLz0gOTUuMDQ3O1xuXHR5IC89IDEwMDtcblx0eiAvPSAxMDguODgzO1xuXG5cdHggPSB4ID4gMC4wMDg4NTYgPyBNYXRoLnBvdyh4LCAxIC8gMykgOiAoNy43ODcgKiB4KSArICgxNiAvIDExNik7XG5cdHkgPSB5ID4gMC4wMDg4NTYgPyBNYXRoLnBvdyh5LCAxIC8gMykgOiAoNy43ODcgKiB5KSArICgxNiAvIDExNik7XG5cdHogPSB6ID4gMC4wMDg4NTYgPyBNYXRoLnBvdyh6LCAxIC8gMykgOiAoNy43ODcgKiB6KSArICgxNiAvIDExNik7XG5cblx0bCA9ICgxMTYgKiB5KSAtIDE2O1xuXHRhID0gNTAwICogKHggLSB5KTtcblx0YiA9IDIwMCAqICh5IC0geik7XG5cblx0cmV0dXJuIFtsLCBhLCBiXTtcbn07XG5cbmNvbnZlcnQuaHNsLnJnYiA9IGZ1bmN0aW9uIChoc2wpIHtcblx0dmFyIGggPSBoc2xbMF0gLyAzNjA7XG5cdHZhciBzID0gaHNsWzFdIC8gMTAwO1xuXHR2YXIgbCA9IGhzbFsyXSAvIDEwMDtcblx0dmFyIHQxO1xuXHR2YXIgdDI7XG5cdHZhciB0Mztcblx0dmFyIHJnYjtcblx0dmFyIHZhbDtcblxuXHRpZiAocyA9PT0gMCkge1xuXHRcdHZhbCA9IGwgKiAyNTU7XG5cdFx0cmV0dXJuIFt2YWwsIHZhbCwgdmFsXTtcblx0fVxuXG5cdGlmIChsIDwgMC41KSB7XG5cdFx0dDIgPSBsICogKDEgKyBzKTtcblx0fSBlbHNlIHtcblx0XHR0MiA9IGwgKyBzIC0gbCAqIHM7XG5cdH1cblxuXHR0MSA9IDIgKiBsIC0gdDI7XG5cblx0cmdiID0gWzAsIDAsIDBdO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IDM7IGkrKykge1xuXHRcdHQzID0gaCArIDEgLyAzICogLShpIC0gMSk7XG5cdFx0aWYgKHQzIDwgMCkge1xuXHRcdFx0dDMrKztcblx0XHR9XG5cdFx0aWYgKHQzID4gMSkge1xuXHRcdFx0dDMtLTtcblx0XHR9XG5cblx0XHRpZiAoNiAqIHQzIDwgMSkge1xuXHRcdFx0dmFsID0gdDEgKyAodDIgLSB0MSkgKiA2ICogdDM7XG5cdFx0fSBlbHNlIGlmICgyICogdDMgPCAxKSB7XG5cdFx0XHR2YWwgPSB0Mjtcblx0XHR9IGVsc2UgaWYgKDMgKiB0MyA8IDIpIHtcblx0XHRcdHZhbCA9IHQxICsgKHQyIC0gdDEpICogKDIgLyAzIC0gdDMpICogNjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFsID0gdDE7XG5cdFx0fVxuXG5cdFx0cmdiW2ldID0gdmFsICogMjU1O1xuXHR9XG5cblx0cmV0dXJuIHJnYjtcbn07XG5cbmNvbnZlcnQuaHNsLmhzdiA9IGZ1bmN0aW9uIChoc2wpIHtcblx0dmFyIGggPSBoc2xbMF07XG5cdHZhciBzID0gaHNsWzFdIC8gMTAwO1xuXHR2YXIgbCA9IGhzbFsyXSAvIDEwMDtcblx0dmFyIHN2O1xuXHR2YXIgdjtcblxuXHRpZiAobCA9PT0gMCkge1xuXHRcdC8vIG5vIG5lZWQgdG8gZG8gY2FsYyBvbiBibGFja1xuXHRcdC8vIGFsc28gYXZvaWRzIGRpdmlkZSBieSAwIGVycm9yXG5cdFx0cmV0dXJuIFswLCAwLCAwXTtcblx0fVxuXG5cdGwgKj0gMjtcblx0cyAqPSAobCA8PSAxKSA/IGwgOiAyIC0gbDtcblx0diA9IChsICsgcykgLyAyO1xuXHRzdiA9ICgyICogcykgLyAobCArIHMpO1xuXG5cdHJldHVybiBbaCwgc3YgKiAxMDAsIHYgKiAxMDBdO1xufTtcblxuY29udmVydC5oc3YucmdiID0gZnVuY3Rpb24gKGhzdikge1xuXHR2YXIgaCA9IGhzdlswXSAvIDYwO1xuXHR2YXIgcyA9IGhzdlsxXSAvIDEwMDtcblx0dmFyIHYgPSBoc3ZbMl0gLyAxMDA7XG5cdHZhciBoaSA9IE1hdGguZmxvb3IoaCkgJSA2O1xuXG5cdHZhciBmID0gaCAtIE1hdGguZmxvb3IoaCk7XG5cdHZhciBwID0gMjU1ICogdiAqICgxIC0gcyk7XG5cdHZhciBxID0gMjU1ICogdiAqICgxIC0gKHMgKiBmKSk7XG5cdHZhciB0ID0gMjU1ICogdiAqICgxIC0gKHMgKiAoMSAtIGYpKSk7XG5cdHYgKj0gMjU1O1xuXG5cdHN3aXRjaCAoaGkpIHtcblx0XHRjYXNlIDA6XG5cdFx0XHRyZXR1cm4gW3YsIHQsIHBdO1xuXHRcdGNhc2UgMTpcblx0XHRcdHJldHVybiBbcSwgdiwgcF07XG5cdFx0Y2FzZSAyOlxuXHRcdFx0cmV0dXJuIFtwLCB2LCB0XTtcblx0XHRjYXNlIDM6XG5cdFx0XHRyZXR1cm4gW3AsIHEsIHZdO1xuXHRcdGNhc2UgNDpcblx0XHRcdHJldHVybiBbdCwgcCwgdl07XG5cdFx0Y2FzZSA1OlxuXHRcdFx0cmV0dXJuIFt2LCBwLCBxXTtcblx0fVxufTtcblxuY29udmVydC5oc3YuaHNsID0gZnVuY3Rpb24gKGhzdikge1xuXHR2YXIgaCA9IGhzdlswXTtcblx0dmFyIHMgPSBoc3ZbMV0gLyAxMDA7XG5cdHZhciB2ID0gaHN2WzJdIC8gMTAwO1xuXHR2YXIgc2w7XG5cdHZhciBsO1xuXG5cdGwgPSAoMiAtIHMpICogdjtcblx0c2wgPSBzICogdjtcblx0c2wgLz0gKGwgPD0gMSkgPyBsIDogMiAtIGw7XG5cdHNsID0gc2wgfHwgMDtcblx0bCAvPSAyO1xuXG5cdHJldHVybiBbaCwgc2wgKiAxMDAsIGwgKiAxMDBdO1xufTtcblxuLy8gaHR0cDovL2Rldi53My5vcmcvY3Nzd2cvY3NzLWNvbG9yLyNod2ItdG8tcmdiXG5jb252ZXJ0Lmh3Yi5yZ2IgPSBmdW5jdGlvbiAoaHdiKSB7XG5cdHZhciBoID0gaHdiWzBdIC8gMzYwO1xuXHR2YXIgd2ggPSBod2JbMV0gLyAxMDA7XG5cdHZhciBibCA9IGh3YlsyXSAvIDEwMDtcblx0dmFyIHJhdGlvID0gd2ggKyBibDtcblx0dmFyIGk7XG5cdHZhciB2O1xuXHR2YXIgZjtcblx0dmFyIG47XG5cblx0Ly8gd2ggKyBibCBjYW50IGJlID4gMVxuXHRpZiAocmF0aW8gPiAxKSB7XG5cdFx0d2ggLz0gcmF0aW87XG5cdFx0YmwgLz0gcmF0aW87XG5cdH1cblxuXHRpID0gTWF0aC5mbG9vcig2ICogaCk7XG5cdHYgPSAxIC0gYmw7XG5cdGYgPSA2ICogaCAtIGk7XG5cblx0aWYgKChpICYgMHgwMSkgIT09IDApIHtcblx0XHRmID0gMSAtIGY7XG5cdH1cblxuXHRuID0gd2ggKyBmICogKHYgLSB3aCk7IC8vIGxpbmVhciBpbnRlcnBvbGF0aW9uXG5cblx0dmFyIHI7XG5cdHZhciBnO1xuXHR2YXIgYjtcblx0c3dpdGNoIChpKSB7XG5cdFx0ZGVmYXVsdDpcblx0XHRjYXNlIDY6XG5cdFx0Y2FzZSAwOiByID0gdjsgZyA9IG47IGIgPSB3aDsgYnJlYWs7XG5cdFx0Y2FzZSAxOiByID0gbjsgZyA9IHY7IGIgPSB3aDsgYnJlYWs7XG5cdFx0Y2FzZSAyOiByID0gd2g7IGcgPSB2OyBiID0gbjsgYnJlYWs7XG5cdFx0Y2FzZSAzOiByID0gd2g7IGcgPSBuOyBiID0gdjsgYnJlYWs7XG5cdFx0Y2FzZSA0OiByID0gbjsgZyA9IHdoOyBiID0gdjsgYnJlYWs7XG5cdFx0Y2FzZSA1OiByID0gdjsgZyA9IHdoOyBiID0gbjsgYnJlYWs7XG5cdH1cblxuXHRyZXR1cm4gW3IgKiAyNTUsIGcgKiAyNTUsIGIgKiAyNTVdO1xufTtcblxuY29udmVydC5jbXlrLnJnYiA9IGZ1bmN0aW9uIChjbXlrKSB7XG5cdHZhciBjID0gY215a1swXSAvIDEwMDtcblx0dmFyIG0gPSBjbXlrWzFdIC8gMTAwO1xuXHR2YXIgeSA9IGNteWtbMl0gLyAxMDA7XG5cdHZhciBrID0gY215a1szXSAvIDEwMDtcblx0dmFyIHI7XG5cdHZhciBnO1xuXHR2YXIgYjtcblxuXHRyID0gMSAtIE1hdGgubWluKDEsIGMgKiAoMSAtIGspICsgayk7XG5cdGcgPSAxIC0gTWF0aC5taW4oMSwgbSAqICgxIC0gaykgKyBrKTtcblx0YiA9IDEgLSBNYXRoLm1pbigxLCB5ICogKDEgLSBrKSArIGspO1xuXG5cdHJldHVybiBbciAqIDI1NSwgZyAqIDI1NSwgYiAqIDI1NV07XG59O1xuXG5jb252ZXJ0Lnh5ei5yZ2IgPSBmdW5jdGlvbiAoeHl6KSB7XG5cdHZhciB4ID0geHl6WzBdIC8gMTAwO1xuXHR2YXIgeSA9IHh5elsxXSAvIDEwMDtcblx0dmFyIHogPSB4eXpbMl0gLyAxMDA7XG5cdHZhciByO1xuXHR2YXIgZztcblx0dmFyIGI7XG5cblx0ciA9ICh4ICogMy4yNDA2KSArICh5ICogLTEuNTM3MikgKyAoeiAqIC0wLjQ5ODYpO1xuXHRnID0gKHggKiAtMC45Njg5KSArICh5ICogMS44NzU4KSArICh6ICogMC4wNDE1KTtcblx0YiA9ICh4ICogMC4wNTU3KSArICh5ICogLTAuMjA0MCkgKyAoeiAqIDEuMDU3MCk7XG5cblx0Ly8gYXNzdW1lIHNSR0Jcblx0ciA9IHIgPiAwLjAwMzEzMDhcblx0XHQ/ICgoMS4wNTUgKiBNYXRoLnBvdyhyLCAxLjAgLyAyLjQpKSAtIDAuMDU1KVxuXHRcdDogciAqPSAxMi45MjtcblxuXHRnID0gZyA+IDAuMDAzMTMwOFxuXHRcdD8gKCgxLjA1NSAqIE1hdGgucG93KGcsIDEuMCAvIDIuNCkpIC0gMC4wNTUpXG5cdFx0OiBnICo9IDEyLjkyO1xuXG5cdGIgPSBiID4gMC4wMDMxMzA4XG5cdFx0PyAoKDEuMDU1ICogTWF0aC5wb3coYiwgMS4wIC8gMi40KSkgLSAwLjA1NSlcblx0XHQ6IGIgKj0gMTIuOTI7XG5cblx0ciA9IE1hdGgubWluKE1hdGgubWF4KDAsIHIpLCAxKTtcblx0ZyA9IE1hdGgubWluKE1hdGgubWF4KDAsIGcpLCAxKTtcblx0YiA9IE1hdGgubWluKE1hdGgubWF4KDAsIGIpLCAxKTtcblxuXHRyZXR1cm4gW3IgKiAyNTUsIGcgKiAyNTUsIGIgKiAyNTVdO1xufTtcblxuY29udmVydC54eXoubGFiID0gZnVuY3Rpb24gKHh5eikge1xuXHR2YXIgeCA9IHh5elswXTtcblx0dmFyIHkgPSB4eXpbMV07XG5cdHZhciB6ID0geHl6WzJdO1xuXHR2YXIgbDtcblx0dmFyIGE7XG5cdHZhciBiO1xuXG5cdHggLz0gOTUuMDQ3O1xuXHR5IC89IDEwMDtcblx0eiAvPSAxMDguODgzO1xuXG5cdHggPSB4ID4gMC4wMDg4NTYgPyBNYXRoLnBvdyh4LCAxIC8gMykgOiAoNy43ODcgKiB4KSArICgxNiAvIDExNik7XG5cdHkgPSB5ID4gMC4wMDg4NTYgPyBNYXRoLnBvdyh5LCAxIC8gMykgOiAoNy43ODcgKiB5KSArICgxNiAvIDExNik7XG5cdHogPSB6ID4gMC4wMDg4NTYgPyBNYXRoLnBvdyh6LCAxIC8gMykgOiAoNy43ODcgKiB6KSArICgxNiAvIDExNik7XG5cblx0bCA9ICgxMTYgKiB5KSAtIDE2O1xuXHRhID0gNTAwICogKHggLSB5KTtcblx0YiA9IDIwMCAqICh5IC0geik7XG5cblx0cmV0dXJuIFtsLCBhLCBiXTtcbn07XG5cbmNvbnZlcnQubGFiLnh5eiA9IGZ1bmN0aW9uIChsYWIpIHtcblx0dmFyIGwgPSBsYWJbMF07XG5cdHZhciBhID0gbGFiWzFdO1xuXHR2YXIgYiA9IGxhYlsyXTtcblx0dmFyIHg7XG5cdHZhciB5O1xuXHR2YXIgejtcblx0dmFyIHkyO1xuXG5cdGlmIChsIDw9IDgpIHtcblx0XHR5ID0gKGwgKiAxMDApIC8gOTAzLjM7XG5cdFx0eTIgPSAoNy43ODcgKiAoeSAvIDEwMCkpICsgKDE2IC8gMTE2KTtcblx0fSBlbHNlIHtcblx0XHR5ID0gMTAwICogTWF0aC5wb3coKGwgKyAxNikgLyAxMTYsIDMpO1xuXHRcdHkyID0gTWF0aC5wb3coeSAvIDEwMCwgMSAvIDMpO1xuXHR9XG5cblx0eCA9IHggLyA5NS4wNDcgPD0gMC4wMDg4NTZcblx0XHQ/IHggPSAoOTUuMDQ3ICogKChhIC8gNTAwKSArIHkyIC0gKDE2IC8gMTE2KSkpIC8gNy43ODdcblx0XHQ6IDk1LjA0NyAqIE1hdGgucG93KChhIC8gNTAwKSArIHkyLCAzKTtcblx0eiA9IHogLyAxMDguODgzIDw9IDAuMDA4ODU5XG5cdFx0PyB6ID0gKDEwOC44ODMgKiAoeTIgLSAoYiAvIDIwMCkgLSAoMTYgLyAxMTYpKSkgLyA3Ljc4N1xuXHRcdDogMTA4Ljg4MyAqIE1hdGgucG93KHkyIC0gKGIgLyAyMDApLCAzKTtcblxuXHRyZXR1cm4gW3gsIHksIHpdO1xufTtcblxuY29udmVydC5sYWIubGNoID0gZnVuY3Rpb24gKGxhYikge1xuXHR2YXIgbCA9IGxhYlswXTtcblx0dmFyIGEgPSBsYWJbMV07XG5cdHZhciBiID0gbGFiWzJdO1xuXHR2YXIgaHI7XG5cdHZhciBoO1xuXHR2YXIgYztcblxuXHRociA9IE1hdGguYXRhbjIoYiwgYSk7XG5cdGggPSBociAqIDM2MCAvIDIgLyBNYXRoLlBJO1xuXG5cdGlmIChoIDwgMCkge1xuXHRcdGggKz0gMzYwO1xuXHR9XG5cblx0YyA9IE1hdGguc3FydChhICogYSArIGIgKiBiKTtcblxuXHRyZXR1cm4gW2wsIGMsIGhdO1xufTtcblxuY29udmVydC5sY2gubGFiID0gZnVuY3Rpb24gKGxjaCkge1xuXHR2YXIgbCA9IGxjaFswXTtcblx0dmFyIGMgPSBsY2hbMV07XG5cdHZhciBoID0gbGNoWzJdO1xuXHR2YXIgYTtcblx0dmFyIGI7XG5cdHZhciBocjtcblxuXHRociA9IGggLyAzNjAgKiAyICogTWF0aC5QSTtcblx0YSA9IGMgKiBNYXRoLmNvcyhocik7XG5cdGIgPSBjICogTWF0aC5zaW4oaHIpO1xuXG5cdHJldHVybiBbbCwgYSwgYl07XG59O1xuXG5jb252ZXJ0LnJnYi5hbnNpMTYgPSBmdW5jdGlvbiAoYXJncykge1xuXHR2YXIgciA9IGFyZ3NbMF07XG5cdHZhciBnID0gYXJnc1sxXTtcblx0dmFyIGIgPSBhcmdzWzJdO1xuXHR2YXIgdmFsdWUgPSAxIGluIGFyZ3VtZW50cyA/IGFyZ3VtZW50c1sxXSA6IGNvbnZlcnQucmdiLmhzdihhcmdzKVsyXTsgLy8gaHN2IC0+IGFuc2kxNiBvcHRpbWl6YXRpb25cblxuXHR2YWx1ZSA9IE1hdGgucm91bmQodmFsdWUgLyA1MCk7XG5cblx0aWYgKHZhbHVlID09PSAwKSB7XG5cdFx0cmV0dXJuIDMwO1xuXHR9XG5cblx0dmFyIGFuc2kgPSAzMFxuXHRcdCsgKChNYXRoLnJvdW5kKGIgLyAyNTUpIDw8IDIpXG5cdFx0fCAoTWF0aC5yb3VuZChnIC8gMjU1KSA8PCAxKVxuXHRcdHwgTWF0aC5yb3VuZChyIC8gMjU1KSk7XG5cblx0aWYgKHZhbHVlID09PSAyKSB7XG5cdFx0YW5zaSArPSA2MDtcblx0fVxuXG5cdHJldHVybiBhbnNpO1xufTtcblxuY29udmVydC5oc3YuYW5zaTE2ID0gZnVuY3Rpb24gKGFyZ3MpIHtcblx0Ly8gb3B0aW1pemF0aW9uIGhlcmU7IHdlIGFscmVhZHkga25vdyB0aGUgdmFsdWUgYW5kIGRvbid0IG5lZWQgdG8gZ2V0XG5cdC8vIGl0IGNvbnZlcnRlZCBmb3IgdXMuXG5cdHJldHVybiBjb252ZXJ0LnJnYi5hbnNpMTYoY29udmVydC5oc3YucmdiKGFyZ3MpLCBhcmdzWzJdKTtcbn07XG5cbmNvbnZlcnQucmdiLmFuc2kyNTYgPSBmdW5jdGlvbiAoYXJncykge1xuXHR2YXIgciA9IGFyZ3NbMF07XG5cdHZhciBnID0gYXJnc1sxXTtcblx0dmFyIGIgPSBhcmdzWzJdO1xuXG5cdC8vIHdlIHVzZSB0aGUgZXh0ZW5kZWQgZ3JleXNjYWxlIHBhbGV0dGUgaGVyZSwgd2l0aCB0aGUgZXhjZXB0aW9uIG9mXG5cdC8vIGJsYWNrIGFuZCB3aGl0ZS4gbm9ybWFsIHBhbGV0dGUgb25seSBoYXMgNCBncmV5c2NhbGUgc2hhZGVzLlxuXHRpZiAociA9PT0gZyAmJiBnID09PSBiKSB7XG5cdFx0aWYgKHIgPCA4KSB7XG5cdFx0XHRyZXR1cm4gMTY7XG5cdFx0fVxuXG5cdFx0aWYgKHIgPiAyNDgpIHtcblx0XHRcdHJldHVybiAyMzE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIE1hdGgucm91bmQoKChyIC0gOCkgLyAyNDcpICogMjQpICsgMjMyO1xuXHR9XG5cblx0dmFyIGFuc2kgPSAxNlxuXHRcdCsgKDM2ICogTWF0aC5yb3VuZChyIC8gMjU1ICogNSkpXG5cdFx0KyAoNiAqIE1hdGgucm91bmQoZyAvIDI1NSAqIDUpKVxuXHRcdCsgTWF0aC5yb3VuZChiIC8gMjU1ICogNSk7XG5cblx0cmV0dXJuIGFuc2k7XG59O1xuXG5jb252ZXJ0LmFuc2kxNi5yZ2IgPSBmdW5jdGlvbiAoYXJncykge1xuXHR2YXIgY29sb3IgPSBhcmdzICUgMTA7XG5cblx0Ly8gaGFuZGxlIGdyZXlzY2FsZVxuXHRpZiAoY29sb3IgPT09IDAgfHwgY29sb3IgPT09IDcpIHtcblx0XHRpZiAoYXJncyA+IDUwKSB7XG5cdFx0XHRjb2xvciArPSAzLjU7XG5cdFx0fVxuXG5cdFx0Y29sb3IgPSBjb2xvciAvIDEwLjUgKiAyNTU7XG5cblx0XHRyZXR1cm4gW2NvbG9yLCBjb2xvciwgY29sb3JdO1xuXHR9XG5cblx0dmFyIG11bHQgPSAofn4oYXJncyA+IDUwKSArIDEpICogMC41O1xuXHR2YXIgciA9ICgoY29sb3IgJiAxKSAqIG11bHQpICogMjU1O1xuXHR2YXIgZyA9ICgoKGNvbG9yID4+IDEpICYgMSkgKiBtdWx0KSAqIDI1NTtcblx0dmFyIGIgPSAoKChjb2xvciA+PiAyKSAmIDEpICogbXVsdCkgKiAyNTU7XG5cblx0cmV0dXJuIFtyLCBnLCBiXTtcbn07XG5cbmNvbnZlcnQuYW5zaTI1Ni5yZ2IgPSBmdW5jdGlvbiAoYXJncykge1xuXHQvLyBoYW5kbGUgZ3JleXNjYWxlXG5cdGlmIChhcmdzID49IDIzMikge1xuXHRcdHZhciBjID0gKGFyZ3MgLSAyMzIpICogMTAgKyA4O1xuXHRcdHJldHVybiBbYywgYywgY107XG5cdH1cblxuXHRhcmdzIC09IDE2O1xuXG5cdHZhciByZW07XG5cdHZhciByID0gTWF0aC5mbG9vcihhcmdzIC8gMzYpIC8gNSAqIDI1NTtcblx0dmFyIGcgPSBNYXRoLmZsb29yKChyZW0gPSBhcmdzICUgMzYpIC8gNikgLyA1ICogMjU1O1xuXHR2YXIgYiA9IChyZW0gJSA2KSAvIDUgKiAyNTU7XG5cblx0cmV0dXJuIFtyLCBnLCBiXTtcbn07XG5cbmNvbnZlcnQucmdiLmhleCA9IGZ1bmN0aW9uIChhcmdzKSB7XG5cdHZhciBpbnRlZ2VyID0gKChNYXRoLnJvdW5kKGFyZ3NbMF0pICYgMHhGRikgPDwgMTYpXG5cdFx0KyAoKE1hdGgucm91bmQoYXJnc1sxXSkgJiAweEZGKSA8PCA4KVxuXHRcdCsgKE1hdGgucm91bmQoYXJnc1syXSkgJiAweEZGKTtcblxuXHR2YXIgc3RyaW5nID0gaW50ZWdlci50b1N0cmluZygxNikudG9VcHBlckNhc2UoKTtcblx0cmV0dXJuICcwMDAwMDAnLnN1YnN0cmluZyhzdHJpbmcubGVuZ3RoKSArIHN0cmluZztcbn07XG5cbmNvbnZlcnQuaGV4LnJnYiA9IGZ1bmN0aW9uIChhcmdzKSB7XG5cdHZhciBtYXRjaCA9IGFyZ3MudG9TdHJpbmcoMTYpLm1hdGNoKC9bYS1mMC05XXs2fS9pKTtcblx0aWYgKCFtYXRjaCkge1xuXHRcdHJldHVybiBbMCwgMCwgMF07XG5cdH1cblxuXHR2YXIgaW50ZWdlciA9IHBhcnNlSW50KG1hdGNoWzBdLCAxNik7XG5cdHZhciByID0gKGludGVnZXIgPj4gMTYpICYgMHhGRjtcblx0dmFyIGcgPSAoaW50ZWdlciA+PiA4KSAmIDB4RkY7XG5cdHZhciBiID0gaW50ZWdlciAmIDB4RkY7XG5cblx0cmV0dXJuIFtyLCBnLCBiXTtcbn07XG5cbmNvbnZlcnQucmdiLmhjZyA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0dmFyIHIgPSByZ2JbMF0gLyAyNTU7XG5cdHZhciBnID0gcmdiWzFdIC8gMjU1O1xuXHR2YXIgYiA9IHJnYlsyXSAvIDI1NTtcblx0dmFyIG1heCA9IE1hdGgubWF4KE1hdGgubWF4KHIsIGcpLCBiKTtcblx0dmFyIG1pbiA9IE1hdGgubWluKE1hdGgubWluKHIsIGcpLCBiKTtcblx0dmFyIGNocm9tYSA9IChtYXggLSBtaW4pO1xuXHR2YXIgZ3JheXNjYWxlO1xuXHR2YXIgaHVlO1xuXG5cdGlmIChjaHJvbWEgPCAxKSB7XG5cdFx0Z3JheXNjYWxlID0gbWluIC8gKDEgLSBjaHJvbWEpO1xuXHR9IGVsc2Uge1xuXHRcdGdyYXlzY2FsZSA9IDA7XG5cdH1cblxuXHRpZiAoY2hyb21hIDw9IDApIHtcblx0XHRodWUgPSAwO1xuXHR9IGVsc2Vcblx0aWYgKG1heCA9PT0gcikge1xuXHRcdGh1ZSA9ICgoZyAtIGIpIC8gY2hyb21hKSAlIDY7XG5cdH0gZWxzZVxuXHRpZiAobWF4ID09PSBnKSB7XG5cdFx0aHVlID0gMiArIChiIC0gcikgLyBjaHJvbWE7XG5cdH0gZWxzZSB7XG5cdFx0aHVlID0gNCArIChyIC0gZykgLyBjaHJvbWEgKyA0O1xuXHR9XG5cblx0aHVlIC89IDY7XG5cdGh1ZSAlPSAxO1xuXG5cdHJldHVybiBbaHVlICogMzYwLCBjaHJvbWEgKiAxMDAsIGdyYXlzY2FsZSAqIDEwMF07XG59O1xuXG5jb252ZXJ0LmhzbC5oY2cgPSBmdW5jdGlvbiAoaHNsKSB7XG5cdHZhciBzID0gaHNsWzFdIC8gMTAwO1xuXHR2YXIgbCA9IGhzbFsyXSAvIDEwMDtcblx0dmFyIGMgPSAxO1xuXHR2YXIgZiA9IDA7XG5cblx0aWYgKGwgPCAwLjUpIHtcblx0XHRjID0gMi4wICogcyAqIGw7XG5cdH0gZWxzZSB7XG5cdFx0YyA9IDIuMCAqIHMgKiAoMS4wIC0gbCk7XG5cdH1cblxuXHRpZiAoYyA8IDEuMCkge1xuXHRcdGYgPSAobCAtIDAuNSAqIGMpIC8gKDEuMCAtIGMpO1xuXHR9XG5cblx0cmV0dXJuIFtoc2xbMF0sIGMgKiAxMDAsIGYgKiAxMDBdO1xufTtcblxuY29udmVydC5oc3YuaGNnID0gZnVuY3Rpb24gKGhzdikge1xuXHR2YXIgcyA9IGhzdlsxXSAvIDEwMDtcblx0dmFyIHYgPSBoc3ZbMl0gLyAxMDA7XG5cblx0dmFyIGMgPSBzICogdjtcblx0dmFyIGYgPSAwO1xuXG5cdGlmIChjIDwgMS4wKSB7XG5cdFx0ZiA9ICh2IC0gYykgLyAoMSAtIGMpO1xuXHR9XG5cblx0cmV0dXJuIFtoc3ZbMF0sIGMgKiAxMDAsIGYgKiAxMDBdO1xufTtcblxuY29udmVydC5oY2cucmdiID0gZnVuY3Rpb24gKGhjZykge1xuXHR2YXIgaCA9IGhjZ1swXSAvIDM2MDtcblx0dmFyIGMgPSBoY2dbMV0gLyAxMDA7XG5cdHZhciBnID0gaGNnWzJdIC8gMTAwO1xuXG5cdGlmIChjID09PSAwLjApIHtcblx0XHRyZXR1cm4gW2cgKiAyNTUsIGcgKiAyNTUsIGcgKiAyNTVdO1xuXHR9XG5cblx0dmFyIHB1cmUgPSBbMCwgMCwgMF07XG5cdHZhciBoaSA9IChoICUgMSkgKiA2O1xuXHR2YXIgdiA9IGhpICUgMTtcblx0dmFyIHcgPSAxIC0gdjtcblx0dmFyIG1nID0gMDtcblxuXHRzd2l0Y2ggKE1hdGguZmxvb3IoaGkpKSB7XG5cdFx0Y2FzZSAwOlxuXHRcdFx0cHVyZVswXSA9IDE7IHB1cmVbMV0gPSB2OyBwdXJlWzJdID0gMDsgYnJlYWs7XG5cdFx0Y2FzZSAxOlxuXHRcdFx0cHVyZVswXSA9IHc7IHB1cmVbMV0gPSAxOyBwdXJlWzJdID0gMDsgYnJlYWs7XG5cdFx0Y2FzZSAyOlxuXHRcdFx0cHVyZVswXSA9IDA7IHB1cmVbMV0gPSAxOyBwdXJlWzJdID0gdjsgYnJlYWs7XG5cdFx0Y2FzZSAzOlxuXHRcdFx0cHVyZVswXSA9IDA7IHB1cmVbMV0gPSB3OyBwdXJlWzJdID0gMTsgYnJlYWs7XG5cdFx0Y2FzZSA0OlxuXHRcdFx0cHVyZVswXSA9IHY7IHB1cmVbMV0gPSAwOyBwdXJlWzJdID0gMTsgYnJlYWs7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdHB1cmVbMF0gPSAxOyBwdXJlWzFdID0gMDsgcHVyZVsyXSA9IHc7XG5cdH1cblxuXHRtZyA9ICgxLjAgLSBjKSAqIGc7XG5cblx0cmV0dXJuIFtcblx0XHQoYyAqIHB1cmVbMF0gKyBtZykgKiAyNTUsXG5cdFx0KGMgKiBwdXJlWzFdICsgbWcpICogMjU1LFxuXHRcdChjICogcHVyZVsyXSArIG1nKSAqIDI1NVxuXHRdO1xufTtcblxuY29udmVydC5oY2cuaHN2ID0gZnVuY3Rpb24gKGhjZykge1xuXHR2YXIgYyA9IGhjZ1sxXSAvIDEwMDtcblx0dmFyIGcgPSBoY2dbMl0gLyAxMDA7XG5cblx0dmFyIHYgPSBjICsgZyAqICgxLjAgLSBjKTtcblx0dmFyIGYgPSAwO1xuXG5cdGlmICh2ID4gMC4wKSB7XG5cdFx0ZiA9IGMgLyB2O1xuXHR9XG5cblx0cmV0dXJuIFtoY2dbMF0sIGYgKiAxMDAsIHYgKiAxMDBdO1xufTtcblxuY29udmVydC5oY2cuaHNsID0gZnVuY3Rpb24gKGhjZykge1xuXHR2YXIgYyA9IGhjZ1sxXSAvIDEwMDtcblx0dmFyIGcgPSBoY2dbMl0gLyAxMDA7XG5cblx0dmFyIGwgPSBnICogKDEuMCAtIGMpICsgMC41ICogYztcblx0dmFyIHMgPSAwO1xuXG5cdGlmIChsID4gMC4wICYmIGwgPCAwLjUpIHtcblx0XHRzID0gYyAvICgyICogbCk7XG5cdH0gZWxzZVxuXHRpZiAobCA+PSAwLjUgJiYgbCA8IDEuMCkge1xuXHRcdHMgPSBjIC8gKDIgKiAoMSAtIGwpKTtcblx0fVxuXG5cdHJldHVybiBbaGNnWzBdLCBzICogMTAwLCBsICogMTAwXTtcbn07XG5cbmNvbnZlcnQuaGNnLmh3YiA9IGZ1bmN0aW9uIChoY2cpIHtcblx0dmFyIGMgPSBoY2dbMV0gLyAxMDA7XG5cdHZhciBnID0gaGNnWzJdIC8gMTAwO1xuXHR2YXIgdiA9IGMgKyBnICogKDEuMCAtIGMpO1xuXHRyZXR1cm4gW2hjZ1swXSwgKHYgLSBjKSAqIDEwMCwgKDEgLSB2KSAqIDEwMF07XG59O1xuXG5jb252ZXJ0Lmh3Yi5oY2cgPSBmdW5jdGlvbiAoaHdiKSB7XG5cdHZhciB3ID0gaHdiWzFdIC8gMTAwO1xuXHR2YXIgYiA9IGh3YlsyXSAvIDEwMDtcblx0dmFyIHYgPSAxIC0gYjtcblx0dmFyIGMgPSB2IC0gdztcblx0dmFyIGcgPSAwO1xuXG5cdGlmIChjIDwgMSkge1xuXHRcdGcgPSAodiAtIGMpIC8gKDEgLSBjKTtcblx0fVxuXG5cdHJldHVybiBbaHdiWzBdLCBjICogMTAwLCBnICogMTAwXTtcbn07XG5cbmNvbnZlcnQuYXBwbGUucmdiID0gZnVuY3Rpb24gKGFwcGxlKSB7XG5cdHJldHVybiBbKGFwcGxlWzBdIC8gNjU1MzUpICogMjU1LCAoYXBwbGVbMV0gLyA2NTUzNSkgKiAyNTUsIChhcHBsZVsyXSAvIDY1NTM1KSAqIDI1NV07XG59O1xuXG5jb252ZXJ0LnJnYi5hcHBsZSA9IGZ1bmN0aW9uIChyZ2IpIHtcblx0cmV0dXJuIFsocmdiWzBdIC8gMjU1KSAqIDY1NTM1LCAocmdiWzFdIC8gMjU1KSAqIDY1NTM1LCAocmdiWzJdIC8gMjU1KSAqIDY1NTM1XTtcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcblx0YWxpY2VibHVlOiBbMjQwLCAyNDgsIDI1NV0sXG5cdGFudGlxdWV3aGl0ZTogWzI1MCwgMjM1LCAyMTVdLFxuXHRhcXVhOiBbMCwgMjU1LCAyNTVdLFxuXHRhcXVhbWFyaW5lOiBbMTI3LCAyNTUsIDIxMl0sXG5cdGF6dXJlOiBbMjQwLCAyNTUsIDI1NV0sXG5cdGJlaWdlOiBbMjQ1LCAyNDUsIDIyMF0sXG5cdGJpc3F1ZTogWzI1NSwgMjI4LCAxOTZdLFxuXHRibGFjazogWzAsIDAsIDBdLFxuXHRibGFuY2hlZGFsbW9uZDogWzI1NSwgMjM1LCAyMDVdLFxuXHRibHVlOiBbMCwgMCwgMjU1XSxcblx0Ymx1ZXZpb2xldDogWzEzOCwgNDMsIDIyNl0sXG5cdGJyb3duOiBbMTY1LCA0MiwgNDJdLFxuXHRidXJseXdvb2Q6IFsyMjIsIDE4NCwgMTM1XSxcblx0Y2FkZXRibHVlOiBbOTUsIDE1OCwgMTYwXSxcblx0Y2hhcnRyZXVzZTogWzEyNywgMjU1LCAwXSxcblx0Y2hvY29sYXRlOiBbMjEwLCAxMDUsIDMwXSxcblx0Y29yYWw6IFsyNTUsIDEyNywgODBdLFxuXHRjb3JuZmxvd2VyYmx1ZTogWzEwMCwgMTQ5LCAyMzddLFxuXHRjb3Juc2lsazogWzI1NSwgMjQ4LCAyMjBdLFxuXHRjcmltc29uOiBbMjIwLCAyMCwgNjBdLFxuXHRjeWFuOiBbMCwgMjU1LCAyNTVdLFxuXHRkYXJrYmx1ZTogWzAsIDAsIDEzOV0sXG5cdGRhcmtjeWFuOiBbMCwgMTM5LCAxMzldLFxuXHRkYXJrZ29sZGVucm9kOiBbMTg0LCAxMzQsIDExXSxcblx0ZGFya2dyYXk6IFsxNjksIDE2OSwgMTY5XSxcblx0ZGFya2dyZWVuOiBbMCwgMTAwLCAwXSxcblx0ZGFya2dyZXk6IFsxNjksIDE2OSwgMTY5XSxcblx0ZGFya2toYWtpOiBbMTg5LCAxODMsIDEwN10sXG5cdGRhcmttYWdlbnRhOiBbMTM5LCAwLCAxMzldLFxuXHRkYXJrb2xpdmVncmVlbjogWzg1LCAxMDcsIDQ3XSxcblx0ZGFya29yYW5nZTogWzI1NSwgMTQwLCAwXSxcblx0ZGFya29yY2hpZDogWzE1MywgNTAsIDIwNF0sXG5cdGRhcmtyZWQ6IFsxMzksIDAsIDBdLFxuXHRkYXJrc2FsbW9uOiBbMjMzLCAxNTAsIDEyMl0sXG5cdGRhcmtzZWFncmVlbjogWzE0MywgMTg4LCAxNDNdLFxuXHRkYXJrc2xhdGVibHVlOiBbNzIsIDYxLCAxMzldLFxuXHRkYXJrc2xhdGVncmF5OiBbNDcsIDc5LCA3OV0sXG5cdGRhcmtzbGF0ZWdyZXk6IFs0NywgNzksIDc5XSxcblx0ZGFya3R1cnF1b2lzZTogWzAsIDIwNiwgMjA5XSxcblx0ZGFya3Zpb2xldDogWzE0OCwgMCwgMjExXSxcblx0ZGVlcHBpbms6IFsyNTUsIDIwLCAxNDddLFxuXHRkZWVwc2t5Ymx1ZTogWzAsIDE5MSwgMjU1XSxcblx0ZGltZ3JheTogWzEwNSwgMTA1LCAxMDVdLFxuXHRkaW1ncmV5OiBbMTA1LCAxMDUsIDEwNV0sXG5cdGRvZGdlcmJsdWU6IFszMCwgMTQ0LCAyNTVdLFxuXHRmaXJlYnJpY2s6IFsxNzgsIDM0LCAzNF0sXG5cdGZsb3JhbHdoaXRlOiBbMjU1LCAyNTAsIDI0MF0sXG5cdGZvcmVzdGdyZWVuOiBbMzQsIDEzOSwgMzRdLFxuXHRmdWNoc2lhOiBbMjU1LCAwLCAyNTVdLFxuXHRnYWluc2Jvcm86IFsyMjAsIDIyMCwgMjIwXSxcblx0Z2hvc3R3aGl0ZTogWzI0OCwgMjQ4LCAyNTVdLFxuXHRnb2xkOiBbMjU1LCAyMTUsIDBdLFxuXHRnb2xkZW5yb2Q6IFsyMTgsIDE2NSwgMzJdLFxuXHRncmF5OiBbMTI4LCAxMjgsIDEyOF0sXG5cdGdyZWVuOiBbMCwgMTI4LCAwXSxcblx0Z3JlZW55ZWxsb3c6IFsxNzMsIDI1NSwgNDddLFxuXHRncmV5OiBbMTI4LCAxMjgsIDEyOF0sXG5cdGhvbmV5ZGV3OiBbMjQwLCAyNTUsIDI0MF0sXG5cdGhvdHBpbms6IFsyNTUsIDEwNSwgMTgwXSxcblx0aW5kaWFucmVkOiBbMjA1LCA5MiwgOTJdLFxuXHRpbmRpZ286IFs3NSwgMCwgMTMwXSxcblx0aXZvcnk6IFsyNTUsIDI1NSwgMjQwXSxcblx0a2hha2k6IFsyNDAsIDIzMCwgMTQwXSxcblx0bGF2ZW5kZXI6IFsyMzAsIDIzMCwgMjUwXSxcblx0bGF2ZW5kZXJibHVzaDogWzI1NSwgMjQwLCAyNDVdLFxuXHRsYXduZ3JlZW46IFsxMjQsIDI1MiwgMF0sXG5cdGxlbW9uY2hpZmZvbjogWzI1NSwgMjUwLCAyMDVdLFxuXHRsaWdodGJsdWU6IFsxNzMsIDIxNiwgMjMwXSxcblx0bGlnaHRjb3JhbDogWzI0MCwgMTI4LCAxMjhdLFxuXHRsaWdodGN5YW46IFsyMjQsIDI1NSwgMjU1XSxcblx0bGlnaHRnb2xkZW5yb2R5ZWxsb3c6IFsyNTAsIDI1MCwgMjEwXSxcblx0bGlnaHRncmF5OiBbMjExLCAyMTEsIDIxMV0sXG5cdGxpZ2h0Z3JlZW46IFsxNDQsIDIzOCwgMTQ0XSxcblx0bGlnaHRncmV5OiBbMjExLCAyMTEsIDIxMV0sXG5cdGxpZ2h0cGluazogWzI1NSwgMTgyLCAxOTNdLFxuXHRsaWdodHNhbG1vbjogWzI1NSwgMTYwLCAxMjJdLFxuXHRsaWdodHNlYWdyZWVuOiBbMzIsIDE3OCwgMTcwXSxcblx0bGlnaHRza3libHVlOiBbMTM1LCAyMDYsIDI1MF0sXG5cdGxpZ2h0c2xhdGVncmF5OiBbMTE5LCAxMzYsIDE1M10sXG5cdGxpZ2h0c2xhdGVncmV5OiBbMTE5LCAxMzYsIDE1M10sXG5cdGxpZ2h0c3RlZWxibHVlOiBbMTc2LCAxOTYsIDIyMl0sXG5cdGxpZ2h0eWVsbG93OiBbMjU1LCAyNTUsIDIyNF0sXG5cdGxpbWU6IFswLCAyNTUsIDBdLFxuXHRsaW1lZ3JlZW46IFs1MCwgMjA1LCA1MF0sXG5cdGxpbmVuOiBbMjUwLCAyNDAsIDIzMF0sXG5cdG1hZ2VudGE6IFsyNTUsIDAsIDI1NV0sXG5cdG1hcm9vbjogWzEyOCwgMCwgMF0sXG5cdG1lZGl1bWFxdWFtYXJpbmU6IFsxMDIsIDIwNSwgMTcwXSxcblx0bWVkaXVtYmx1ZTogWzAsIDAsIDIwNV0sXG5cdG1lZGl1bW9yY2hpZDogWzE4NiwgODUsIDIxMV0sXG5cdG1lZGl1bXB1cnBsZTogWzE0NywgMTEyLCAyMTldLFxuXHRtZWRpdW1zZWFncmVlbjogWzYwLCAxNzksIDExM10sXG5cdG1lZGl1bXNsYXRlYmx1ZTogWzEyMywgMTA0LCAyMzhdLFxuXHRtZWRpdW1zcHJpbmdncmVlbjogWzAsIDI1MCwgMTU0XSxcblx0bWVkaXVtdHVycXVvaXNlOiBbNzIsIDIwOSwgMjA0XSxcblx0bWVkaXVtdmlvbGV0cmVkOiBbMTk5LCAyMSwgMTMzXSxcblx0bWlkbmlnaHRibHVlOiBbMjUsIDI1LCAxMTJdLFxuXHRtaW50Y3JlYW06IFsyNDUsIDI1NSwgMjUwXSxcblx0bWlzdHlyb3NlOiBbMjU1LCAyMjgsIDIyNV0sXG5cdG1vY2Nhc2luOiBbMjU1LCAyMjgsIDE4MV0sXG5cdG5hdmFqb3doaXRlOiBbMjU1LCAyMjIsIDE3M10sXG5cdG5hdnk6IFswLCAwLCAxMjhdLFxuXHRvbGRsYWNlOiBbMjUzLCAyNDUsIDIzMF0sXG5cdG9saXZlOiBbMTI4LCAxMjgsIDBdLFxuXHRvbGl2ZWRyYWI6IFsxMDcsIDE0MiwgMzVdLFxuXHRvcmFuZ2U6IFsyNTUsIDE2NSwgMF0sXG5cdG9yYW5nZXJlZDogWzI1NSwgNjksIDBdLFxuXHRvcmNoaWQ6IFsyMTgsIDExMiwgMjE0XSxcblx0cGFsZWdvbGRlbnJvZDogWzIzOCwgMjMyLCAxNzBdLFxuXHRwYWxlZ3JlZW46IFsxNTIsIDI1MSwgMTUyXSxcblx0cGFsZXR1cnF1b2lzZTogWzE3NSwgMjM4LCAyMzhdLFxuXHRwYWxldmlvbGV0cmVkOiBbMjE5LCAxMTIsIDE0N10sXG5cdHBhcGF5YXdoaXA6IFsyNTUsIDIzOSwgMjEzXSxcblx0cGVhY2hwdWZmOiBbMjU1LCAyMTgsIDE4NV0sXG5cdHBlcnU6IFsyMDUsIDEzMywgNjNdLFxuXHRwaW5rOiBbMjU1LCAxOTIsIDIwM10sXG5cdHBsdW06IFsyMjEsIDE2MCwgMjIxXSxcblx0cG93ZGVyYmx1ZTogWzE3NiwgMjI0LCAyMzBdLFxuXHRwdXJwbGU6IFsxMjgsIDAsIDEyOF0sXG5cdHJlYmVjY2FwdXJwbGU6IFsxMDIsIDUxLCAxNTNdLFxuXHRyZWQ6IFsyNTUsIDAsIDBdLFxuXHRyb3N5YnJvd246IFsxODgsIDE0MywgMTQzXSxcblx0cm95YWxibHVlOiBbNjUsIDEwNSwgMjI1XSxcblx0c2FkZGxlYnJvd246IFsxMzksIDY5LCAxOV0sXG5cdHNhbG1vbjogWzI1MCwgMTI4LCAxMTRdLFxuXHRzYW5keWJyb3duOiBbMjQ0LCAxNjQsIDk2XSxcblx0c2VhZ3JlZW46IFs0NiwgMTM5LCA4N10sXG5cdHNlYXNoZWxsOiBbMjU1LCAyNDUsIDIzOF0sXG5cdHNpZW5uYTogWzE2MCwgODIsIDQ1XSxcblx0c2lsdmVyOiBbMTkyLCAxOTIsIDE5Ml0sXG5cdHNreWJsdWU6IFsxMzUsIDIwNiwgMjM1XSxcblx0c2xhdGVibHVlOiBbMTA2LCA5MCwgMjA1XSxcblx0c2xhdGVncmF5OiBbMTEyLCAxMjgsIDE0NF0sXG5cdHNsYXRlZ3JleTogWzExMiwgMTI4LCAxNDRdLFxuXHRzbm93OiBbMjU1LCAyNTAsIDI1MF0sXG5cdHNwcmluZ2dyZWVuOiBbMCwgMjU1LCAxMjddLFxuXHRzdGVlbGJsdWU6IFs3MCwgMTMwLCAxODBdLFxuXHR0YW46IFsyMTAsIDE4MCwgMTQwXSxcblx0dGVhbDogWzAsIDEyOCwgMTI4XSxcblx0dGhpc3RsZTogWzIxNiwgMTkxLCAyMTZdLFxuXHR0b21hdG86IFsyNTUsIDk5LCA3MV0sXG5cdHR1cnF1b2lzZTogWzY0LCAyMjQsIDIwOF0sXG5cdHZpb2xldDogWzIzOCwgMTMwLCAyMzhdLFxuXHR3aGVhdDogWzI0NSwgMjIyLCAxNzldLFxuXHR3aGl0ZTogWzI1NSwgMjU1LCAyNTVdLFxuXHR3aGl0ZXNtb2tlOiBbMjQ1LCAyNDUsIDI0NV0sXG5cdHllbGxvdzogWzI1NSwgMjU1LCAwXSxcblx0eWVsbG93Z3JlZW46IFsxNTQsIDIwNSwgNTBdXG59O1xuXG4iLCJ2YXIgY29udmVyc2lvbnMgPSByZXF1aXJlKCcuL2NvbnZlcnNpb25zJyk7XG52YXIgcm91dGUgPSByZXF1aXJlKCcuL3JvdXRlJyk7XG5cbnZhciBjb252ZXJ0ID0ge307XG5cbnZhciBtb2RlbHMgPSBPYmplY3Qua2V5cyhjb252ZXJzaW9ucyk7XG5cbmZ1bmN0aW9uIHdyYXBSYXcoZm4pIHtcblx0dmFyIHdyYXBwZWRGbiA9IGZ1bmN0aW9uIChhcmdzKSB7XG5cdFx0aWYgKGFyZ3MgPT09IHVuZGVmaW5lZCB8fCBhcmdzID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gYXJncztcblx0XHR9XG5cblx0XHRpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcblx0XHRcdGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBmbihhcmdzKTtcblx0fTtcblxuXHQvLyBwcmVzZXJ2ZSAuY29udmVyc2lvbiBwcm9wZXJ0eSBpZiB0aGVyZSBpcyBvbmVcblx0aWYgKCdjb252ZXJzaW9uJyBpbiBmbikge1xuXHRcdHdyYXBwZWRGbi5jb252ZXJzaW9uID0gZm4uY29udmVyc2lvbjtcblx0fVxuXG5cdHJldHVybiB3cmFwcGVkRm47XG59XG5cbmZ1bmN0aW9uIHdyYXBSb3VuZGVkKGZuKSB7XG5cdHZhciB3cmFwcGVkRm4gPSBmdW5jdGlvbiAoYXJncykge1xuXHRcdGlmIChhcmdzID09PSB1bmRlZmluZWQgfHwgYXJncyA9PT0gbnVsbCkge1xuXHRcdFx0cmV0dXJuIGFyZ3M7XG5cdFx0fVxuXG5cdFx0aWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG5cdFx0XHRhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKTtcblx0XHR9XG5cblx0XHR2YXIgcmVzdWx0ID0gZm4oYXJncyk7XG5cblx0XHQvLyB3ZSdyZSBhc3N1bWluZyB0aGUgcmVzdWx0IGlzIGFuIGFycmF5IGhlcmUuXG5cdFx0Ly8gc2VlIG5vdGljZSBpbiBjb252ZXJzaW9ucy5qczsgZG9uJ3QgdXNlIGJveCB0eXBlc1xuXHRcdC8vIGluIGNvbnZlcnNpb24gZnVuY3Rpb25zLlxuXHRcdGlmICh0eXBlb2YgcmVzdWx0ID09PSAnb2JqZWN0Jykge1xuXHRcdFx0Zm9yICh2YXIgbGVuID0gcmVzdWx0Lmxlbmd0aCwgaSA9IDA7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0XHRyZXN1bHRbaV0gPSBNYXRoLnJvdW5kKHJlc3VsdFtpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fTtcblxuXHQvLyBwcmVzZXJ2ZSAuY29udmVyc2lvbiBwcm9wZXJ0eSBpZiB0aGVyZSBpcyBvbmVcblx0aWYgKCdjb252ZXJzaW9uJyBpbiBmbikge1xuXHRcdHdyYXBwZWRGbi5jb252ZXJzaW9uID0gZm4uY29udmVyc2lvbjtcblx0fVxuXG5cdHJldHVybiB3cmFwcGVkRm47XG59XG5cbm1vZGVscy5mb3JFYWNoKGZ1bmN0aW9uIChmcm9tTW9kZWwpIHtcblx0Y29udmVydFtmcm9tTW9kZWxdID0ge307XG5cblx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGNvbnZlcnRbZnJvbU1vZGVsXSwgJ2NoYW5uZWxzJywge3ZhbHVlOiBjb252ZXJzaW9uc1tmcm9tTW9kZWxdLmNoYW5uZWxzfSk7XG5cblx0dmFyIHJvdXRlcyA9IHJvdXRlKGZyb21Nb2RlbCk7XG5cdHZhciByb3V0ZU1vZGVscyA9IE9iamVjdC5rZXlzKHJvdXRlcyk7XG5cblx0cm91dGVNb2RlbHMuZm9yRWFjaChmdW5jdGlvbiAodG9Nb2RlbCkge1xuXHRcdHZhciBmbiA9IHJvdXRlc1t0b01vZGVsXTtcblxuXHRcdGNvbnZlcnRbZnJvbU1vZGVsXVt0b01vZGVsXSA9IHdyYXBSb3VuZGVkKGZuKTtcblx0XHRjb252ZXJ0W2Zyb21Nb2RlbF1bdG9Nb2RlbF0ucmF3ID0gd3JhcFJhdyhmbik7XG5cdH0pO1xufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gY29udmVydDtcbiIsInZhciBjb252ZXJzaW9ucyA9IHJlcXVpcmUoJy4vY29udmVyc2lvbnMnKTtcblxuLypcblx0dGhpcyBmdW5jdGlvbiByb3V0ZXMgYSBtb2RlbCB0byBhbGwgb3RoZXIgbW9kZWxzLlxuXG5cdGFsbCBmdW5jdGlvbnMgdGhhdCBhcmUgcm91dGVkIGhhdmUgYSBwcm9wZXJ0eSBgLmNvbnZlcnNpb25gIGF0dGFjaGVkXG5cdHRvIHRoZSByZXR1cm5lZCBzeW50aGV0aWMgZnVuY3Rpb24uIFRoaXMgcHJvcGVydHkgaXMgYW4gYXJyYXlcblx0b2Ygc3RyaW5ncywgZWFjaCB3aXRoIHRoZSBzdGVwcyBpbiBiZXR3ZWVuIHRoZSAnZnJvbScgYW5kICd0bydcblx0Y29sb3IgbW9kZWxzIChpbmNsdXNpdmUpLlxuXG5cdGNvbnZlcnNpb25zIHRoYXQgYXJlIG5vdCBwb3NzaWJsZSBzaW1wbHkgYXJlIG5vdCBpbmNsdWRlZC5cbiovXG5cbi8vIGh0dHBzOi8vanNwZXJmLmNvbS9vYmplY3Qta2V5cy12cy1mb3ItaW4td2l0aC1jbG9zdXJlLzNcbnZhciBtb2RlbHMgPSBPYmplY3Qua2V5cyhjb252ZXJzaW9ucyk7XG5cbmZ1bmN0aW9uIGJ1aWxkR3JhcGgoKSB7XG5cdHZhciBncmFwaCA9IHt9O1xuXG5cdGZvciAodmFyIGxlbiA9IG1vZGVscy5sZW5ndGgsIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0XHRncmFwaFttb2RlbHNbaV1dID0ge1xuXHRcdFx0Ly8gaHR0cDovL2pzcGVyZi5jb20vMS12cy1pbmZpbml0eVxuXHRcdFx0Ly8gbWljcm8tb3B0LCBidXQgdGhpcyBpcyBzaW1wbGUuXG5cdFx0XHRkaXN0YW5jZTogLTEsXG5cdFx0XHRwYXJlbnQ6IG51bGxcblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIGdyYXBoO1xufVxuXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CcmVhZHRoLWZpcnN0X3NlYXJjaFxuZnVuY3Rpb24gZGVyaXZlQkZTKGZyb21Nb2RlbCkge1xuXHR2YXIgZ3JhcGggPSBidWlsZEdyYXBoKCk7XG5cdHZhciBxdWV1ZSA9IFtmcm9tTW9kZWxdOyAvLyB1bnNoaWZ0IC0+IHF1ZXVlIC0+IHBvcFxuXG5cdGdyYXBoW2Zyb21Nb2RlbF0uZGlzdGFuY2UgPSAwO1xuXG5cdHdoaWxlIChxdWV1ZS5sZW5ndGgpIHtcblx0XHR2YXIgY3VycmVudCA9IHF1ZXVlLnBvcCgpO1xuXHRcdHZhciBhZGphY2VudHMgPSBPYmplY3Qua2V5cyhjb252ZXJzaW9uc1tjdXJyZW50XSk7XG5cblx0XHRmb3IgKHZhciBsZW4gPSBhZGphY2VudHMubGVuZ3RoLCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHR2YXIgYWRqYWNlbnQgPSBhZGphY2VudHNbaV07XG5cdFx0XHR2YXIgbm9kZSA9IGdyYXBoW2FkamFjZW50XTtcblxuXHRcdFx0aWYgKG5vZGUuZGlzdGFuY2UgPT09IC0xKSB7XG5cdFx0XHRcdG5vZGUuZGlzdGFuY2UgPSBncmFwaFtjdXJyZW50XS5kaXN0YW5jZSArIDE7XG5cdFx0XHRcdG5vZGUucGFyZW50ID0gY3VycmVudDtcblx0XHRcdFx0cXVldWUudW5zaGlmdChhZGphY2VudCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIGdyYXBoO1xufVxuXG5mdW5jdGlvbiBsaW5rKGZyb20sIHRvKSB7XG5cdHJldHVybiBmdW5jdGlvbiAoYXJncykge1xuXHRcdHJldHVybiB0byhmcm9tKGFyZ3MpKTtcblx0fTtcbn1cblxuZnVuY3Rpb24gd3JhcENvbnZlcnNpb24odG9Nb2RlbCwgZ3JhcGgpIHtcblx0dmFyIHBhdGggPSBbZ3JhcGhbdG9Nb2RlbF0ucGFyZW50LCB0b01vZGVsXTtcblx0dmFyIGZuID0gY29udmVyc2lvbnNbZ3JhcGhbdG9Nb2RlbF0ucGFyZW50XVt0b01vZGVsXTtcblxuXHR2YXIgY3VyID0gZ3JhcGhbdG9Nb2RlbF0ucGFyZW50O1xuXHR3aGlsZSAoZ3JhcGhbY3VyXS5wYXJlbnQpIHtcblx0XHRwYXRoLnVuc2hpZnQoZ3JhcGhbY3VyXS5wYXJlbnQpO1xuXHRcdGZuID0gbGluayhjb252ZXJzaW9uc1tncmFwaFtjdXJdLnBhcmVudF1bY3VyXSwgZm4pO1xuXHRcdGN1ciA9IGdyYXBoW2N1cl0ucGFyZW50O1xuXHR9XG5cblx0Zm4uY29udmVyc2lvbiA9IHBhdGg7XG5cdHJldHVybiBmbjtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZnJvbU1vZGVsKSB7XG5cdHZhciBncmFwaCA9IGRlcml2ZUJGUyhmcm9tTW9kZWwpO1xuXHR2YXIgY29udmVyc2lvbiA9IHt9O1xuXG5cdHZhciBtb2RlbHMgPSBPYmplY3Qua2V5cyhncmFwaCk7XG5cdGZvciAodmFyIGxlbiA9IG1vZGVscy5sZW5ndGgsIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcblx0XHR2YXIgdG9Nb2RlbCA9IG1vZGVsc1tpXTtcblx0XHR2YXIgbm9kZSA9IGdyYXBoW3RvTW9kZWxdO1xuXG5cdFx0aWYgKG5vZGUucGFyZW50ID09PSBudWxsKSB7XG5cdFx0XHQvLyBubyBwb3NzaWJsZSBjb252ZXJzaW9uLCBvciB0aGlzIG5vZGUgaXMgdGhlIHNvdXJjZSBtb2RlbC5cblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGNvbnZlcnNpb25bdG9Nb2RlbF0gPSB3cmFwQ29udmVyc2lvbih0b01vZGVsLCBncmFwaCk7XG5cdH1cblxuXHRyZXR1cm4gY29udmVyc2lvbjtcbn07XG5cbiIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG5cdFwiYWxpY2VibHVlXCI6IFsyNDAsIDI0OCwgMjU1XSxcclxuXHRcImFudGlxdWV3aGl0ZVwiOiBbMjUwLCAyMzUsIDIxNV0sXHJcblx0XCJhcXVhXCI6IFswLCAyNTUsIDI1NV0sXHJcblx0XCJhcXVhbWFyaW5lXCI6IFsxMjcsIDI1NSwgMjEyXSxcclxuXHRcImF6dXJlXCI6IFsyNDAsIDI1NSwgMjU1XSxcclxuXHRcImJlaWdlXCI6IFsyNDUsIDI0NSwgMjIwXSxcclxuXHRcImJpc3F1ZVwiOiBbMjU1LCAyMjgsIDE5Nl0sXHJcblx0XCJibGFja1wiOiBbMCwgMCwgMF0sXHJcblx0XCJibGFuY2hlZGFsbW9uZFwiOiBbMjU1LCAyMzUsIDIwNV0sXHJcblx0XCJibHVlXCI6IFswLCAwLCAyNTVdLFxyXG5cdFwiYmx1ZXZpb2xldFwiOiBbMTM4LCA0MywgMjI2XSxcclxuXHRcImJyb3duXCI6IFsxNjUsIDQyLCA0Ml0sXHJcblx0XCJidXJseXdvb2RcIjogWzIyMiwgMTg0LCAxMzVdLFxyXG5cdFwiY2FkZXRibHVlXCI6IFs5NSwgMTU4LCAxNjBdLFxyXG5cdFwiY2hhcnRyZXVzZVwiOiBbMTI3LCAyNTUsIDBdLFxyXG5cdFwiY2hvY29sYXRlXCI6IFsyMTAsIDEwNSwgMzBdLFxyXG5cdFwiY29yYWxcIjogWzI1NSwgMTI3LCA4MF0sXHJcblx0XCJjb3JuZmxvd2VyYmx1ZVwiOiBbMTAwLCAxNDksIDIzN10sXHJcblx0XCJjb3Juc2lsa1wiOiBbMjU1LCAyNDgsIDIyMF0sXHJcblx0XCJjcmltc29uXCI6IFsyMjAsIDIwLCA2MF0sXHJcblx0XCJjeWFuXCI6IFswLCAyNTUsIDI1NV0sXHJcblx0XCJkYXJrYmx1ZVwiOiBbMCwgMCwgMTM5XSxcclxuXHRcImRhcmtjeWFuXCI6IFswLCAxMzksIDEzOV0sXHJcblx0XCJkYXJrZ29sZGVucm9kXCI6IFsxODQsIDEzNCwgMTFdLFxyXG5cdFwiZGFya2dyYXlcIjogWzE2OSwgMTY5LCAxNjldLFxyXG5cdFwiZGFya2dyZWVuXCI6IFswLCAxMDAsIDBdLFxyXG5cdFwiZGFya2dyZXlcIjogWzE2OSwgMTY5LCAxNjldLFxyXG5cdFwiZGFya2toYWtpXCI6IFsxODksIDE4MywgMTA3XSxcclxuXHRcImRhcmttYWdlbnRhXCI6IFsxMzksIDAsIDEzOV0sXHJcblx0XCJkYXJrb2xpdmVncmVlblwiOiBbODUsIDEwNywgNDddLFxyXG5cdFwiZGFya29yYW5nZVwiOiBbMjU1LCAxNDAsIDBdLFxyXG5cdFwiZGFya29yY2hpZFwiOiBbMTUzLCA1MCwgMjA0XSxcclxuXHRcImRhcmtyZWRcIjogWzEzOSwgMCwgMF0sXHJcblx0XCJkYXJrc2FsbW9uXCI6IFsyMzMsIDE1MCwgMTIyXSxcclxuXHRcImRhcmtzZWFncmVlblwiOiBbMTQzLCAxODgsIDE0M10sXHJcblx0XCJkYXJrc2xhdGVibHVlXCI6IFs3MiwgNjEsIDEzOV0sXHJcblx0XCJkYXJrc2xhdGVncmF5XCI6IFs0NywgNzksIDc5XSxcclxuXHRcImRhcmtzbGF0ZWdyZXlcIjogWzQ3LCA3OSwgNzldLFxyXG5cdFwiZGFya3R1cnF1b2lzZVwiOiBbMCwgMjA2LCAyMDldLFxyXG5cdFwiZGFya3Zpb2xldFwiOiBbMTQ4LCAwLCAyMTFdLFxyXG5cdFwiZGVlcHBpbmtcIjogWzI1NSwgMjAsIDE0N10sXHJcblx0XCJkZWVwc2t5Ymx1ZVwiOiBbMCwgMTkxLCAyNTVdLFxyXG5cdFwiZGltZ3JheVwiOiBbMTA1LCAxMDUsIDEwNV0sXHJcblx0XCJkaW1ncmV5XCI6IFsxMDUsIDEwNSwgMTA1XSxcclxuXHRcImRvZGdlcmJsdWVcIjogWzMwLCAxNDQsIDI1NV0sXHJcblx0XCJmaXJlYnJpY2tcIjogWzE3OCwgMzQsIDM0XSxcclxuXHRcImZsb3JhbHdoaXRlXCI6IFsyNTUsIDI1MCwgMjQwXSxcclxuXHRcImZvcmVzdGdyZWVuXCI6IFszNCwgMTM5LCAzNF0sXHJcblx0XCJmdWNoc2lhXCI6IFsyNTUsIDAsIDI1NV0sXHJcblx0XCJnYWluc2Jvcm9cIjogWzIyMCwgMjIwLCAyMjBdLFxyXG5cdFwiZ2hvc3R3aGl0ZVwiOiBbMjQ4LCAyNDgsIDI1NV0sXHJcblx0XCJnb2xkXCI6IFsyNTUsIDIxNSwgMF0sXHJcblx0XCJnb2xkZW5yb2RcIjogWzIxOCwgMTY1LCAzMl0sXHJcblx0XCJncmF5XCI6IFsxMjgsIDEyOCwgMTI4XSxcclxuXHRcImdyZWVuXCI6IFswLCAxMjgsIDBdLFxyXG5cdFwiZ3JlZW55ZWxsb3dcIjogWzE3MywgMjU1LCA0N10sXHJcblx0XCJncmV5XCI6IFsxMjgsIDEyOCwgMTI4XSxcclxuXHRcImhvbmV5ZGV3XCI6IFsyNDAsIDI1NSwgMjQwXSxcclxuXHRcImhvdHBpbmtcIjogWzI1NSwgMTA1LCAxODBdLFxyXG5cdFwiaW5kaWFucmVkXCI6IFsyMDUsIDkyLCA5Ml0sXHJcblx0XCJpbmRpZ29cIjogWzc1LCAwLCAxMzBdLFxyXG5cdFwiaXZvcnlcIjogWzI1NSwgMjU1LCAyNDBdLFxyXG5cdFwia2hha2lcIjogWzI0MCwgMjMwLCAxNDBdLFxyXG5cdFwibGF2ZW5kZXJcIjogWzIzMCwgMjMwLCAyNTBdLFxyXG5cdFwibGF2ZW5kZXJibHVzaFwiOiBbMjU1LCAyNDAsIDI0NV0sXHJcblx0XCJsYXduZ3JlZW5cIjogWzEyNCwgMjUyLCAwXSxcclxuXHRcImxlbW9uY2hpZmZvblwiOiBbMjU1LCAyNTAsIDIwNV0sXHJcblx0XCJsaWdodGJsdWVcIjogWzE3MywgMjE2LCAyMzBdLFxyXG5cdFwibGlnaHRjb3JhbFwiOiBbMjQwLCAxMjgsIDEyOF0sXHJcblx0XCJsaWdodGN5YW5cIjogWzIyNCwgMjU1LCAyNTVdLFxyXG5cdFwibGlnaHRnb2xkZW5yb2R5ZWxsb3dcIjogWzI1MCwgMjUwLCAyMTBdLFxyXG5cdFwibGlnaHRncmF5XCI6IFsyMTEsIDIxMSwgMjExXSxcclxuXHRcImxpZ2h0Z3JlZW5cIjogWzE0NCwgMjM4LCAxNDRdLFxyXG5cdFwibGlnaHRncmV5XCI6IFsyMTEsIDIxMSwgMjExXSxcclxuXHRcImxpZ2h0cGlua1wiOiBbMjU1LCAxODIsIDE5M10sXHJcblx0XCJsaWdodHNhbG1vblwiOiBbMjU1LCAxNjAsIDEyMl0sXHJcblx0XCJsaWdodHNlYWdyZWVuXCI6IFszMiwgMTc4LCAxNzBdLFxyXG5cdFwibGlnaHRza3libHVlXCI6IFsxMzUsIDIwNiwgMjUwXSxcclxuXHRcImxpZ2h0c2xhdGVncmF5XCI6IFsxMTksIDEzNiwgMTUzXSxcclxuXHRcImxpZ2h0c2xhdGVncmV5XCI6IFsxMTksIDEzNiwgMTUzXSxcclxuXHRcImxpZ2h0c3RlZWxibHVlXCI6IFsxNzYsIDE5NiwgMjIyXSxcclxuXHRcImxpZ2h0eWVsbG93XCI6IFsyNTUsIDI1NSwgMjI0XSxcclxuXHRcImxpbWVcIjogWzAsIDI1NSwgMF0sXHJcblx0XCJsaW1lZ3JlZW5cIjogWzUwLCAyMDUsIDUwXSxcclxuXHRcImxpbmVuXCI6IFsyNTAsIDI0MCwgMjMwXSxcclxuXHRcIm1hZ2VudGFcIjogWzI1NSwgMCwgMjU1XSxcclxuXHRcIm1hcm9vblwiOiBbMTI4LCAwLCAwXSxcclxuXHRcIm1lZGl1bWFxdWFtYXJpbmVcIjogWzEwMiwgMjA1LCAxNzBdLFxyXG5cdFwibWVkaXVtYmx1ZVwiOiBbMCwgMCwgMjA1XSxcclxuXHRcIm1lZGl1bW9yY2hpZFwiOiBbMTg2LCA4NSwgMjExXSxcclxuXHRcIm1lZGl1bXB1cnBsZVwiOiBbMTQ3LCAxMTIsIDIxOV0sXHJcblx0XCJtZWRpdW1zZWFncmVlblwiOiBbNjAsIDE3OSwgMTEzXSxcclxuXHRcIm1lZGl1bXNsYXRlYmx1ZVwiOiBbMTIzLCAxMDQsIDIzOF0sXHJcblx0XCJtZWRpdW1zcHJpbmdncmVlblwiOiBbMCwgMjUwLCAxNTRdLFxyXG5cdFwibWVkaXVtdHVycXVvaXNlXCI6IFs3MiwgMjA5LCAyMDRdLFxyXG5cdFwibWVkaXVtdmlvbGV0cmVkXCI6IFsxOTksIDIxLCAxMzNdLFxyXG5cdFwibWlkbmlnaHRibHVlXCI6IFsyNSwgMjUsIDExMl0sXHJcblx0XCJtaW50Y3JlYW1cIjogWzI0NSwgMjU1LCAyNTBdLFxyXG5cdFwibWlzdHlyb3NlXCI6IFsyNTUsIDIyOCwgMjI1XSxcclxuXHRcIm1vY2Nhc2luXCI6IFsyNTUsIDIyOCwgMTgxXSxcclxuXHRcIm5hdmFqb3doaXRlXCI6IFsyNTUsIDIyMiwgMTczXSxcclxuXHRcIm5hdnlcIjogWzAsIDAsIDEyOF0sXHJcblx0XCJvbGRsYWNlXCI6IFsyNTMsIDI0NSwgMjMwXSxcclxuXHRcIm9saXZlXCI6IFsxMjgsIDEyOCwgMF0sXHJcblx0XCJvbGl2ZWRyYWJcIjogWzEwNywgMTQyLCAzNV0sXHJcblx0XCJvcmFuZ2VcIjogWzI1NSwgMTY1LCAwXSxcclxuXHRcIm9yYW5nZXJlZFwiOiBbMjU1LCA2OSwgMF0sXHJcblx0XCJvcmNoaWRcIjogWzIxOCwgMTEyLCAyMTRdLFxyXG5cdFwicGFsZWdvbGRlbnJvZFwiOiBbMjM4LCAyMzIsIDE3MF0sXHJcblx0XCJwYWxlZ3JlZW5cIjogWzE1MiwgMjUxLCAxNTJdLFxyXG5cdFwicGFsZXR1cnF1b2lzZVwiOiBbMTc1LCAyMzgsIDIzOF0sXHJcblx0XCJwYWxldmlvbGV0cmVkXCI6IFsyMTksIDExMiwgMTQ3XSxcclxuXHRcInBhcGF5YXdoaXBcIjogWzI1NSwgMjM5LCAyMTNdLFxyXG5cdFwicGVhY2hwdWZmXCI6IFsyNTUsIDIxOCwgMTg1XSxcclxuXHRcInBlcnVcIjogWzIwNSwgMTMzLCA2M10sXHJcblx0XCJwaW5rXCI6IFsyNTUsIDE5MiwgMjAzXSxcclxuXHRcInBsdW1cIjogWzIyMSwgMTYwLCAyMjFdLFxyXG5cdFwicG93ZGVyYmx1ZVwiOiBbMTc2LCAyMjQsIDIzMF0sXHJcblx0XCJwdXJwbGVcIjogWzEyOCwgMCwgMTI4XSxcclxuXHRcInJlYmVjY2FwdXJwbGVcIjogWzEwMiwgNTEsIDE1M10sXHJcblx0XCJyZWRcIjogWzI1NSwgMCwgMF0sXHJcblx0XCJyb3N5YnJvd25cIjogWzE4OCwgMTQzLCAxNDNdLFxyXG5cdFwicm95YWxibHVlXCI6IFs2NSwgMTA1LCAyMjVdLFxyXG5cdFwic2FkZGxlYnJvd25cIjogWzEzOSwgNjksIDE5XSxcclxuXHRcInNhbG1vblwiOiBbMjUwLCAxMjgsIDExNF0sXHJcblx0XCJzYW5keWJyb3duXCI6IFsyNDQsIDE2NCwgOTZdLFxyXG5cdFwic2VhZ3JlZW5cIjogWzQ2LCAxMzksIDg3XSxcclxuXHRcInNlYXNoZWxsXCI6IFsyNTUsIDI0NSwgMjM4XSxcclxuXHRcInNpZW5uYVwiOiBbMTYwLCA4MiwgNDVdLFxyXG5cdFwic2lsdmVyXCI6IFsxOTIsIDE5MiwgMTkyXSxcclxuXHRcInNreWJsdWVcIjogWzEzNSwgMjA2LCAyMzVdLFxyXG5cdFwic2xhdGVibHVlXCI6IFsxMDYsIDkwLCAyMDVdLFxyXG5cdFwic2xhdGVncmF5XCI6IFsxMTIsIDEyOCwgMTQ0XSxcclxuXHRcInNsYXRlZ3JleVwiOiBbMTEyLCAxMjgsIDE0NF0sXHJcblx0XCJzbm93XCI6IFsyNTUsIDI1MCwgMjUwXSxcclxuXHRcInNwcmluZ2dyZWVuXCI6IFswLCAyNTUsIDEyN10sXHJcblx0XCJzdGVlbGJsdWVcIjogWzcwLCAxMzAsIDE4MF0sXHJcblx0XCJ0YW5cIjogWzIxMCwgMTgwLCAxNDBdLFxyXG5cdFwidGVhbFwiOiBbMCwgMTI4LCAxMjhdLFxyXG5cdFwidGhpc3RsZVwiOiBbMjE2LCAxOTEsIDIxNl0sXHJcblx0XCJ0b21hdG9cIjogWzI1NSwgOTksIDcxXSxcclxuXHRcInR1cnF1b2lzZVwiOiBbNjQsIDIyNCwgMjA4XSxcclxuXHRcInZpb2xldFwiOiBbMjM4LCAxMzAsIDIzOF0sXHJcblx0XCJ3aGVhdFwiOiBbMjQ1LCAyMjIsIDE3OV0sXHJcblx0XCJ3aGl0ZVwiOiBbMjU1LCAyNTUsIDI1NV0sXHJcblx0XCJ3aGl0ZXNtb2tlXCI6IFsyNDUsIDI0NSwgMjQ1XSxcclxuXHRcInllbGxvd1wiOiBbMjU1LCAyNTUsIDBdLFxyXG5cdFwieWVsbG93Z3JlZW5cIjogWzE1NCwgMjA1LCA1MF1cclxufTsiLCIvKiBNSVQgbGljZW5zZSAqL1xudmFyIGNvbG9yTmFtZXMgPSByZXF1aXJlKCdjb2xvci1uYW1lJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgZ2V0UmdiYTogZ2V0UmdiYSxcbiAgIGdldEhzbGE6IGdldEhzbGEsXG4gICBnZXRSZ2I6IGdldFJnYixcbiAgIGdldEhzbDogZ2V0SHNsLFxuICAgZ2V0SHdiOiBnZXRId2IsXG4gICBnZXRBbHBoYTogZ2V0QWxwaGEsXG5cbiAgIGhleFN0cmluZzogaGV4U3RyaW5nLFxuICAgcmdiU3RyaW5nOiByZ2JTdHJpbmcsXG4gICByZ2JhU3RyaW5nOiByZ2JhU3RyaW5nLFxuICAgcGVyY2VudFN0cmluZzogcGVyY2VudFN0cmluZyxcbiAgIHBlcmNlbnRhU3RyaW5nOiBwZXJjZW50YVN0cmluZyxcbiAgIGhzbFN0cmluZzogaHNsU3RyaW5nLFxuICAgaHNsYVN0cmluZzogaHNsYVN0cmluZyxcbiAgIGh3YlN0cmluZzogaHdiU3RyaW5nLFxuICAga2V5d29yZDoga2V5d29yZFxufVxuXG5mdW5jdGlvbiBnZXRSZ2JhKHN0cmluZykge1xuICAgaWYgKCFzdHJpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgIH1cbiAgIHZhciBhYmJyID0gIC9eIyhbYS1mQS1GMC05XXszfSkkLyxcbiAgICAgICBoZXggPSAgL14jKFthLWZBLUYwLTldezZ9KSQvLFxuICAgICAgIHJnYmEgPSAvXnJnYmE/XFwoXFxzKihbKy1dP1xcZCspXFxzKixcXHMqKFsrLV0/XFxkKylcXHMqLFxccyooWystXT9cXGQrKVxccyooPzosXFxzKihbKy1dP1tcXGRcXC5dKylcXHMqKT9cXCkkLyxcbiAgICAgICBwZXIgPSAvXnJnYmE/XFwoXFxzKihbKy1dP1tcXGRcXC5dKylcXCVcXHMqLFxccyooWystXT9bXFxkXFwuXSspXFwlXFxzKixcXHMqKFsrLV0/W1xcZFxcLl0rKVxcJVxccyooPzosXFxzKihbKy1dP1tcXGRcXC5dKylcXHMqKT9cXCkkLyxcbiAgICAgICBrZXl3b3JkID0gLyhcXEQrKS87XG5cbiAgIHZhciByZ2IgPSBbMCwgMCwgMF0sXG4gICAgICAgYSA9IDEsXG4gICAgICAgbWF0Y2ggPSBzdHJpbmcubWF0Y2goYWJicik7XG4gICBpZiAobWF0Y2gpIHtcbiAgICAgIG1hdGNoID0gbWF0Y2hbMV07XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJnYi5sZW5ndGg7IGkrKykge1xuICAgICAgICAgcmdiW2ldID0gcGFyc2VJbnQobWF0Y2hbaV0gKyBtYXRjaFtpXSwgMTYpO1xuICAgICAgfVxuICAgfVxuICAgZWxzZSBpZiAobWF0Y2ggPSBzdHJpbmcubWF0Y2goaGV4KSkge1xuICAgICAgbWF0Y2ggPSBtYXRjaFsxXTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmdiLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICByZ2JbaV0gPSBwYXJzZUludChtYXRjaC5zbGljZShpICogMiwgaSAqIDIgKyAyKSwgMTYpO1xuICAgICAgfVxuICAgfVxuICAgZWxzZSBpZiAobWF0Y2ggPSBzdHJpbmcubWF0Y2gocmdiYSkpIHtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgcmdiLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICByZ2JbaV0gPSBwYXJzZUludChtYXRjaFtpICsgMV0pO1xuICAgICAgfVxuICAgICAgYSA9IHBhcnNlRmxvYXQobWF0Y2hbNF0pO1xuICAgfVxuICAgZWxzZSBpZiAobWF0Y2ggPSBzdHJpbmcubWF0Y2gocGVyKSkge1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZ2IubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgIHJnYltpXSA9IE1hdGgucm91bmQocGFyc2VGbG9hdChtYXRjaFtpICsgMV0pICogMi41NSk7XG4gICAgICB9XG4gICAgICBhID0gcGFyc2VGbG9hdChtYXRjaFs0XSk7XG4gICB9XG4gICBlbHNlIGlmIChtYXRjaCA9IHN0cmluZy5tYXRjaChrZXl3b3JkKSkge1xuICAgICAgaWYgKG1hdGNoWzFdID09IFwidHJhbnNwYXJlbnRcIikge1xuICAgICAgICAgcmV0dXJuIFswLCAwLCAwLCAwXTtcbiAgICAgIH1cbiAgICAgIHJnYiA9IGNvbG9yTmFtZXNbbWF0Y2hbMV1dO1xuICAgICAgaWYgKCFyZ2IpIHtcbiAgICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgIH1cblxuICAgZm9yICh2YXIgaSA9IDA7IGkgPCByZ2IubGVuZ3RoOyBpKyspIHtcbiAgICAgIHJnYltpXSA9IHNjYWxlKHJnYltpXSwgMCwgMjU1KTtcbiAgIH1cbiAgIGlmICghYSAmJiBhICE9IDApIHtcbiAgICAgIGEgPSAxO1xuICAgfVxuICAgZWxzZSB7XG4gICAgICBhID0gc2NhbGUoYSwgMCwgMSk7XG4gICB9XG4gICByZ2JbM10gPSBhO1xuICAgcmV0dXJuIHJnYjtcbn1cblxuZnVuY3Rpb24gZ2V0SHNsYShzdHJpbmcpIHtcbiAgIGlmICghc3RyaW5nKSB7XG4gICAgICByZXR1cm47XG4gICB9XG4gICB2YXIgaHNsID0gL15oc2xhP1xcKFxccyooWystXT9cXGQrKSg/OmRlZyk/XFxzKixcXHMqKFsrLV0/W1xcZFxcLl0rKSVcXHMqLFxccyooWystXT9bXFxkXFwuXSspJVxccyooPzosXFxzKihbKy1dP1tcXGRcXC5dKylcXHMqKT9cXCkvO1xuICAgdmFyIG1hdGNoID0gc3RyaW5nLm1hdGNoKGhzbCk7XG4gICBpZiAobWF0Y2gpIHtcbiAgICAgIHZhciBhbHBoYSA9IHBhcnNlRmxvYXQobWF0Y2hbNF0pO1xuICAgICAgdmFyIGggPSBzY2FsZShwYXJzZUludChtYXRjaFsxXSksIDAsIDM2MCksXG4gICAgICAgICAgcyA9IHNjYWxlKHBhcnNlRmxvYXQobWF0Y2hbMl0pLCAwLCAxMDApLFxuICAgICAgICAgIGwgPSBzY2FsZShwYXJzZUZsb2F0KG1hdGNoWzNdKSwgMCwgMTAwKSxcbiAgICAgICAgICBhID0gc2NhbGUoaXNOYU4oYWxwaGEpID8gMSA6IGFscGhhLCAwLCAxKTtcbiAgICAgIHJldHVybiBbaCwgcywgbCwgYV07XG4gICB9XG59XG5cbmZ1bmN0aW9uIGdldEh3YihzdHJpbmcpIHtcbiAgIGlmICghc3RyaW5nKSB7XG4gICAgICByZXR1cm47XG4gICB9XG4gICB2YXIgaHdiID0gL15od2JcXChcXHMqKFsrLV0/XFxkKykoPzpkZWcpP1xccyosXFxzKihbKy1dP1tcXGRcXC5dKyklXFxzKixcXHMqKFsrLV0/W1xcZFxcLl0rKSVcXHMqKD86LFxccyooWystXT9bXFxkXFwuXSspXFxzKik/XFwpLztcbiAgIHZhciBtYXRjaCA9IHN0cmluZy5tYXRjaChod2IpO1xuICAgaWYgKG1hdGNoKSB7XG4gICAgdmFyIGFscGhhID0gcGFyc2VGbG9hdChtYXRjaFs0XSk7XG4gICAgICB2YXIgaCA9IHNjYWxlKHBhcnNlSW50KG1hdGNoWzFdKSwgMCwgMzYwKSxcbiAgICAgICAgICB3ID0gc2NhbGUocGFyc2VGbG9hdChtYXRjaFsyXSksIDAsIDEwMCksXG4gICAgICAgICAgYiA9IHNjYWxlKHBhcnNlRmxvYXQobWF0Y2hbM10pLCAwLCAxMDApLFxuICAgICAgICAgIGEgPSBzY2FsZShpc05hTihhbHBoYSkgPyAxIDogYWxwaGEsIDAsIDEpO1xuICAgICAgcmV0dXJuIFtoLCB3LCBiLCBhXTtcbiAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UmdiKHN0cmluZykge1xuICAgdmFyIHJnYmEgPSBnZXRSZ2JhKHN0cmluZyk7XG4gICByZXR1cm4gcmdiYSAmJiByZ2JhLnNsaWNlKDAsIDMpO1xufVxuXG5mdW5jdGlvbiBnZXRIc2woc3RyaW5nKSB7XG4gIHZhciBoc2xhID0gZ2V0SHNsYShzdHJpbmcpO1xuICByZXR1cm4gaHNsYSAmJiBoc2xhLnNsaWNlKDAsIDMpO1xufVxuXG5mdW5jdGlvbiBnZXRBbHBoYShzdHJpbmcpIHtcbiAgIHZhciB2YWxzID0gZ2V0UmdiYShzdHJpbmcpO1xuICAgaWYgKHZhbHMpIHtcbiAgICAgIHJldHVybiB2YWxzWzNdO1xuICAgfVxuICAgZWxzZSBpZiAodmFscyA9IGdldEhzbGEoc3RyaW5nKSkge1xuICAgICAgcmV0dXJuIHZhbHNbM107XG4gICB9XG4gICBlbHNlIGlmICh2YWxzID0gZ2V0SHdiKHN0cmluZykpIHtcbiAgICAgIHJldHVybiB2YWxzWzNdO1xuICAgfVxufVxuXG4vLyBnZW5lcmF0b3JzXG5mdW5jdGlvbiBoZXhTdHJpbmcocmdiKSB7XG4gICByZXR1cm4gXCIjXCIgKyBoZXhEb3VibGUocmdiWzBdKSArIGhleERvdWJsZShyZ2JbMV0pXG4gICAgICAgICAgICAgICsgaGV4RG91YmxlKHJnYlsyXSk7XG59XG5cbmZ1bmN0aW9uIHJnYlN0cmluZyhyZ2JhLCBhbHBoYSkge1xuICAgaWYgKGFscGhhIDwgMSB8fCAocmdiYVszXSAmJiByZ2JhWzNdIDwgMSkpIHtcbiAgICAgIHJldHVybiByZ2JhU3RyaW5nKHJnYmEsIGFscGhhKTtcbiAgIH1cbiAgIHJldHVybiBcInJnYihcIiArIHJnYmFbMF0gKyBcIiwgXCIgKyByZ2JhWzFdICsgXCIsIFwiICsgcmdiYVsyXSArIFwiKVwiO1xufVxuXG5mdW5jdGlvbiByZ2JhU3RyaW5nKHJnYmEsIGFscGhhKSB7XG4gICBpZiAoYWxwaGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYWxwaGEgPSAocmdiYVszXSAhPT0gdW5kZWZpbmVkID8gcmdiYVszXSA6IDEpO1xuICAgfVxuICAgcmV0dXJuIFwicmdiYShcIiArIHJnYmFbMF0gKyBcIiwgXCIgKyByZ2JhWzFdICsgXCIsIFwiICsgcmdiYVsyXVxuICAgICAgICAgICArIFwiLCBcIiArIGFscGhhICsgXCIpXCI7XG59XG5cbmZ1bmN0aW9uIHBlcmNlbnRTdHJpbmcocmdiYSwgYWxwaGEpIHtcbiAgIGlmIChhbHBoYSA8IDEgfHwgKHJnYmFbM10gJiYgcmdiYVszXSA8IDEpKSB7XG4gICAgICByZXR1cm4gcGVyY2VudGFTdHJpbmcocmdiYSwgYWxwaGEpO1xuICAgfVxuICAgdmFyIHIgPSBNYXRoLnJvdW5kKHJnYmFbMF0vMjU1ICogMTAwKSxcbiAgICAgICBnID0gTWF0aC5yb3VuZChyZ2JhWzFdLzI1NSAqIDEwMCksXG4gICAgICAgYiA9IE1hdGgucm91bmQocmdiYVsyXS8yNTUgKiAxMDApO1xuXG4gICByZXR1cm4gXCJyZ2IoXCIgKyByICsgXCIlLCBcIiArIGcgKyBcIiUsIFwiICsgYiArIFwiJSlcIjtcbn1cblxuZnVuY3Rpb24gcGVyY2VudGFTdHJpbmcocmdiYSwgYWxwaGEpIHtcbiAgIHZhciByID0gTWF0aC5yb3VuZChyZ2JhWzBdLzI1NSAqIDEwMCksXG4gICAgICAgZyA9IE1hdGgucm91bmQocmdiYVsxXS8yNTUgKiAxMDApLFxuICAgICAgIGIgPSBNYXRoLnJvdW5kKHJnYmFbMl0vMjU1ICogMTAwKTtcbiAgIHJldHVybiBcInJnYmEoXCIgKyByICsgXCIlLCBcIiArIGcgKyBcIiUsIFwiICsgYiArIFwiJSwgXCIgKyAoYWxwaGEgfHwgcmdiYVszXSB8fCAxKSArIFwiKVwiO1xufVxuXG5mdW5jdGlvbiBoc2xTdHJpbmcoaHNsYSwgYWxwaGEpIHtcbiAgIGlmIChhbHBoYSA8IDEgfHwgKGhzbGFbM10gJiYgaHNsYVszXSA8IDEpKSB7XG4gICAgICByZXR1cm4gaHNsYVN0cmluZyhoc2xhLCBhbHBoYSk7XG4gICB9XG4gICByZXR1cm4gXCJoc2woXCIgKyBoc2xhWzBdICsgXCIsIFwiICsgaHNsYVsxXSArIFwiJSwgXCIgKyBoc2xhWzJdICsgXCIlKVwiO1xufVxuXG5mdW5jdGlvbiBoc2xhU3RyaW5nKGhzbGEsIGFscGhhKSB7XG4gICBpZiAoYWxwaGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYWxwaGEgPSAoaHNsYVszXSAhPT0gdW5kZWZpbmVkID8gaHNsYVszXSA6IDEpO1xuICAgfVxuICAgcmV0dXJuIFwiaHNsYShcIiArIGhzbGFbMF0gKyBcIiwgXCIgKyBoc2xhWzFdICsgXCIlLCBcIiArIGhzbGFbMl0gKyBcIiUsIFwiXG4gICAgICAgICAgICsgYWxwaGEgKyBcIilcIjtcbn1cblxuLy8gaHdiIGlzIGEgYml0IGRpZmZlcmVudCB0aGFuIHJnYihhKSAmIGhzbChhKSBzaW5jZSB0aGVyZSBpcyBubyBhbHBoYSBzcGVjaWZpYyBzeW50YXhcbi8vIChod2IgaGF2ZSBhbHBoYSBvcHRpb25hbCAmIDEgaXMgZGVmYXVsdCB2YWx1ZSlcbmZ1bmN0aW9uIGh3YlN0cmluZyhod2IsIGFscGhhKSB7XG4gICBpZiAoYWxwaGEgPT09IHVuZGVmaW5lZCkge1xuICAgICAgYWxwaGEgPSAoaHdiWzNdICE9PSB1bmRlZmluZWQgPyBod2JbM10gOiAxKTtcbiAgIH1cbiAgIHJldHVybiBcImh3YihcIiArIGh3YlswXSArIFwiLCBcIiArIGh3YlsxXSArIFwiJSwgXCIgKyBod2JbMl0gKyBcIiVcIlxuICAgICAgICAgICArIChhbHBoYSAhPT0gdW5kZWZpbmVkICYmIGFscGhhICE9PSAxID8gXCIsIFwiICsgYWxwaGEgOiBcIlwiKSArIFwiKVwiO1xufVxuXG5mdW5jdGlvbiBrZXl3b3JkKHJnYikge1xuICByZXR1cm4gcmV2ZXJzZU5hbWVzW3JnYi5zbGljZSgwLCAzKV07XG59XG5cbi8vIGhlbHBlcnNcbmZ1bmN0aW9uIHNjYWxlKG51bSwgbWluLCBtYXgpIHtcbiAgIHJldHVybiBNYXRoLm1pbihNYXRoLm1heChtaW4sIG51bSksIG1heCk7XG59XG5cbmZ1bmN0aW9uIGhleERvdWJsZShudW0pIHtcbiAgdmFyIHN0ciA9IG51bS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKTtcbiAgcmV0dXJuIChzdHIubGVuZ3RoIDwgMikgPyBcIjBcIiArIHN0ciA6IHN0cjtcbn1cblxuXG4vL2NyZWF0ZSBhIGxpc3Qgb2YgcmV2ZXJzZSBjb2xvciBuYW1lc1xudmFyIHJldmVyc2VOYW1lcyA9IHt9O1xuZm9yICh2YXIgbmFtZSBpbiBjb2xvck5hbWVzKSB7XG4gICByZXZlcnNlTmFtZXNbY29sb3JOYW1lc1tuYW1lXV0gPSBuYW1lO1xufVxuIiwiLyogTUlUIGxpY2Vuc2UgKi9cbnZhciBjbG9uZSA9IHJlcXVpcmUoJ2Nsb25lJyk7XG52YXIgY29udmVydCA9IHJlcXVpcmUoJ2NvbG9yLWNvbnZlcnQnKTtcbnZhciBzdHJpbmcgPSByZXF1aXJlKCdjb2xvci1zdHJpbmcnKTtcblxudmFyIENvbG9yID0gZnVuY3Rpb24gKG9iaikge1xuXHRpZiAob2JqIGluc3RhbmNlb2YgQ29sb3IpIHtcblx0XHRyZXR1cm4gb2JqO1xuXHR9XG5cdGlmICghKHRoaXMgaW5zdGFuY2VvZiBDb2xvcikpIHtcblx0XHRyZXR1cm4gbmV3IENvbG9yKG9iaik7XG5cdH1cblxuXHR0aGlzLnZhbHVlcyA9IHtcblx0XHRyZ2I6IFswLCAwLCAwXSxcblx0XHRoc2w6IFswLCAwLCAwXSxcblx0XHRoc3Y6IFswLCAwLCAwXSxcblx0XHRod2I6IFswLCAwLCAwXSxcblx0XHRjbXlrOiBbMCwgMCwgMCwgMF0sXG5cdFx0YWxwaGE6IDFcblx0fTtcblxuXHQvLyBwYXJzZSBDb2xvcigpIGFyZ3VtZW50XG5cdHZhciB2YWxzO1xuXHRpZiAodHlwZW9mIG9iaiA9PT0gJ3N0cmluZycpIHtcblx0XHR2YWxzID0gc3RyaW5nLmdldFJnYmEob2JqKTtcblx0XHRpZiAodmFscykge1xuXHRcdFx0dGhpcy5zZXRWYWx1ZXMoJ3JnYicsIHZhbHMpO1xuXHRcdH0gZWxzZSBpZiAodmFscyA9IHN0cmluZy5nZXRIc2xhKG9iaikpIHtcblx0XHRcdHRoaXMuc2V0VmFsdWVzKCdoc2wnLCB2YWxzKTtcblx0XHR9IGVsc2UgaWYgKHZhbHMgPSBzdHJpbmcuZ2V0SHdiKG9iaikpIHtcblx0XHRcdHRoaXMuc2V0VmFsdWVzKCdod2InLCB2YWxzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcGFyc2UgY29sb3IgZnJvbSBzdHJpbmcgXCInICsgb2JqICsgJ1wiJyk7XG5cdFx0fVxuXHR9IGVsc2UgaWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnKSB7XG5cdFx0dmFscyA9IG9iajtcblx0XHRpZiAodmFscy5yICE9PSB1bmRlZmluZWQgfHwgdmFscy5yZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5zZXRWYWx1ZXMoJ3JnYicsIHZhbHMpO1xuXHRcdH0gZWxzZSBpZiAodmFscy5sICE9PSB1bmRlZmluZWQgfHwgdmFscy5saWdodG5lc3MgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5zZXRWYWx1ZXMoJ2hzbCcsIHZhbHMpO1xuXHRcdH0gZWxzZSBpZiAodmFscy52ICE9PSB1bmRlZmluZWQgfHwgdmFscy52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnNldFZhbHVlcygnaHN2JywgdmFscyk7XG5cdFx0fSBlbHNlIGlmICh2YWxzLncgIT09IHVuZGVmaW5lZCB8fCB2YWxzLndoaXRlbmVzcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnNldFZhbHVlcygnaHdiJywgdmFscyk7XG5cdFx0fSBlbHNlIGlmICh2YWxzLmMgIT09IHVuZGVmaW5lZCB8fCB2YWxzLmN5YW4gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5zZXRWYWx1ZXMoJ2NteWsnLCB2YWxzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdVbmFibGUgdG8gcGFyc2UgY29sb3IgZnJvbSBvYmplY3QgJyArIEpTT04uc3RyaW5naWZ5KG9iaikpO1xuXHRcdH1cblx0fVxufTtcblxuQ29sb3IucHJvdG90eXBlID0ge1xuXHRyZ2I6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRTcGFjZSgncmdiJywgYXJndW1lbnRzKTtcblx0fSxcblx0aHNsOiBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0U3BhY2UoJ2hzbCcsIGFyZ3VtZW50cyk7XG5cdH0sXG5cdGhzdjogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLnNldFNwYWNlKCdoc3YnLCBhcmd1bWVudHMpO1xuXHR9LFxuXHRod2I6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRTcGFjZSgnaHdiJywgYXJndW1lbnRzKTtcblx0fSxcblx0Y215azogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLnNldFNwYWNlKCdjbXlrJywgYXJndW1lbnRzKTtcblx0fSxcblxuXHRyZ2JBcnJheTogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlcy5yZ2I7XG5cdH0sXG5cdGhzbEFycmF5OiBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRoaXMudmFsdWVzLmhzbDtcblx0fSxcblx0aHN2QXJyYXk6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy52YWx1ZXMuaHN2O1xuXHR9LFxuXHRod2JBcnJheTogZnVuY3Rpb24gKCkge1xuXHRcdGlmICh0aGlzLnZhbHVlcy5hbHBoYSAhPT0gMSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudmFsdWVzLmh3Yi5jb25jYXQoW3RoaXMudmFsdWVzLmFscGhhXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnZhbHVlcy5od2I7XG5cdH0sXG5cdGNteWtBcnJheTogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlcy5jbXlrO1xuXHR9LFxuXHRyZ2JhQXJyYXk6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgcmdiID0gdGhpcy52YWx1ZXMucmdiO1xuXHRcdHJldHVybiByZ2IuY29uY2F0KFt0aGlzLnZhbHVlcy5hbHBoYV0pO1xuXHR9LFxuXHRoc2xhQXJyYXk6IGZ1bmN0aW9uICgpIHtcblx0XHR2YXIgaHNsID0gdGhpcy52YWx1ZXMuaHNsO1xuXHRcdHJldHVybiBoc2wuY29uY2F0KFt0aGlzLnZhbHVlcy5hbHBoYV0pO1xuXHR9LFxuXHRhbHBoYTogZnVuY3Rpb24gKHZhbCkge1xuXHRcdGlmICh2YWwgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudmFsdWVzLmFscGhhO1xuXHRcdH1cblx0XHR0aGlzLnNldFZhbHVlcygnYWxwaGEnLCB2YWwpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdHJlZDogZnVuY3Rpb24gKHZhbCkge1xuXHRcdHJldHVybiB0aGlzLnNldENoYW5uZWwoJ3JnYicsIDAsIHZhbCk7XG5cdH0sXG5cdGdyZWVuOiBmdW5jdGlvbiAodmFsKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0Q2hhbm5lbCgncmdiJywgMSwgdmFsKTtcblx0fSxcblx0Ymx1ZTogZnVuY3Rpb24gKHZhbCkge1xuXHRcdHJldHVybiB0aGlzLnNldENoYW5uZWwoJ3JnYicsIDIsIHZhbCk7XG5cdH0sXG5cdGh1ZTogZnVuY3Rpb24gKHZhbCkge1xuXHRcdGlmICh2YWwpIHtcblx0XHRcdHZhbCAlPSAzNjA7XG5cdFx0XHR2YWwgPSB2YWwgPCAwID8gMzYwICsgdmFsIDogdmFsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdoc2wnLCAwLCB2YWwpO1xuXHR9LFxuXHRzYXR1cmF0aW9uOiBmdW5jdGlvbiAodmFsKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0Q2hhbm5lbCgnaHNsJywgMSwgdmFsKTtcblx0fSxcblx0bGlnaHRuZXNzOiBmdW5jdGlvbiAodmFsKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2V0Q2hhbm5lbCgnaHNsJywgMiwgdmFsKTtcblx0fSxcblx0c2F0dXJhdGlvbnY6IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdoc3YnLCAxLCB2YWwpO1xuXHR9LFxuXHR3aGl0ZW5lc3M6IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdod2InLCAxLCB2YWwpO1xuXHR9LFxuXHRibGFja25lc3M6IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdod2InLCAyLCB2YWwpO1xuXHR9LFxuXHR2YWx1ZTogZnVuY3Rpb24gKHZhbCkge1xuXHRcdHJldHVybiB0aGlzLnNldENoYW5uZWwoJ2hzdicsIDIsIHZhbCk7XG5cdH0sXG5cdGN5YW46IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdjbXlrJywgMCwgdmFsKTtcblx0fSxcblx0bWFnZW50YTogZnVuY3Rpb24gKHZhbCkge1xuXHRcdHJldHVybiB0aGlzLnNldENoYW5uZWwoJ2NteWsnLCAxLCB2YWwpO1xuXHR9LFxuXHR5ZWxsb3c6IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdjbXlrJywgMiwgdmFsKTtcblx0fSxcblx0YmxhY2s6IGZ1bmN0aW9uICh2YWwpIHtcblx0XHRyZXR1cm4gdGhpcy5zZXRDaGFubmVsKCdjbXlrJywgMywgdmFsKTtcblx0fSxcblxuXHRoZXhTdHJpbmc6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gc3RyaW5nLmhleFN0cmluZyh0aGlzLnZhbHVlcy5yZ2IpO1xuXHR9LFxuXHRyZ2JTdHJpbmc6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gc3RyaW5nLnJnYlN0cmluZyh0aGlzLnZhbHVlcy5yZ2IsIHRoaXMudmFsdWVzLmFscGhhKTtcblx0fSxcblx0cmdiYVN0cmluZzogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBzdHJpbmcucmdiYVN0cmluZyh0aGlzLnZhbHVlcy5yZ2IsIHRoaXMudmFsdWVzLmFscGhhKTtcblx0fSxcblx0cGVyY2VudFN0cmluZzogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBzdHJpbmcucGVyY2VudFN0cmluZyh0aGlzLnZhbHVlcy5yZ2IsIHRoaXMudmFsdWVzLmFscGhhKTtcblx0fSxcblx0aHNsU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5oc2xTdHJpbmcodGhpcy52YWx1ZXMuaHNsLCB0aGlzLnZhbHVlcy5hbHBoYSk7XG5cdH0sXG5cdGhzbGFTdHJpbmc6IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gc3RyaW5nLmhzbGFTdHJpbmcodGhpcy52YWx1ZXMuaHNsLCB0aGlzLnZhbHVlcy5hbHBoYSk7XG5cdH0sXG5cdGh3YlN0cmluZzogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiBzdHJpbmcuaHdiU3RyaW5nKHRoaXMudmFsdWVzLmh3YiwgdGhpcy52YWx1ZXMuYWxwaGEpO1xuXHR9LFxuXHRrZXl3b3JkOiBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5rZXl3b3JkKHRoaXMudmFsdWVzLnJnYiwgdGhpcy52YWx1ZXMuYWxwaGEpO1xuXHR9LFxuXG5cdHJnYk51bWJlcjogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiAodGhpcy52YWx1ZXMucmdiWzBdIDw8IDE2KSB8ICh0aGlzLnZhbHVlcy5yZ2JbMV0gPDwgOCkgfCB0aGlzLnZhbHVlcy5yZ2JbMl07XG5cdH0sXG5cblx0bHVtaW5vc2l0eTogZnVuY3Rpb24gKCkge1xuXHRcdC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL1dDQUcyMC8jcmVsYXRpdmVsdW1pbmFuY2VkZWZcblx0XHR2YXIgcmdiID0gdGhpcy52YWx1ZXMucmdiO1xuXHRcdHZhciBsdW0gPSBbXTtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IHJnYi5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIGNoYW4gPSByZ2JbaV0gLyAyNTU7XG5cdFx0XHRsdW1baV0gPSAoY2hhbiA8PSAwLjAzOTI4KSA/IGNoYW4gLyAxMi45MiA6IE1hdGgucG93KCgoY2hhbiArIDAuMDU1KSAvIDEuMDU1KSwgMi40KTtcblx0XHR9XG5cdFx0cmV0dXJuIDAuMjEyNiAqIGx1bVswXSArIDAuNzE1MiAqIGx1bVsxXSArIDAuMDcyMiAqIGx1bVsyXTtcblx0fSxcblxuXHRjb250cmFzdDogZnVuY3Rpb24gKGNvbG9yMikge1xuXHRcdC8vIGh0dHA6Ly93d3cudzMub3JnL1RSL1dDQUcyMC8jY29udHJhc3QtcmF0aW9kZWZcblx0XHR2YXIgbHVtMSA9IHRoaXMubHVtaW5vc2l0eSgpO1xuXHRcdHZhciBsdW0yID0gY29sb3IyLmx1bWlub3NpdHkoKTtcblx0XHRpZiAobHVtMSA+IGx1bTIpIHtcblx0XHRcdHJldHVybiAobHVtMSArIDAuMDUpIC8gKGx1bTIgKyAwLjA1KTtcblx0XHR9XG5cdFx0cmV0dXJuIChsdW0yICsgMC4wNSkgLyAobHVtMSArIDAuMDUpO1xuXHR9LFxuXG5cdGxldmVsOiBmdW5jdGlvbiAoY29sb3IyKSB7XG5cdFx0dmFyIGNvbnRyYXN0UmF0aW8gPSB0aGlzLmNvbnRyYXN0KGNvbG9yMik7XG5cdFx0aWYgKGNvbnRyYXN0UmF0aW8gPj0gNy4xKSB7XG5cdFx0XHRyZXR1cm4gJ0FBQSc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChjb250cmFzdFJhdGlvID49IDQuNSkgPyAnQUEnIDogJyc7XG5cdH0sXG5cblx0ZGFyazogZnVuY3Rpb24gKCkge1xuXHRcdC8vIFlJUSBlcXVhdGlvbiBmcm9tIGh0dHA6Ly8yNHdheXMub3JnLzIwMTAvY2FsY3VsYXRpbmctY29sb3ItY29udHJhc3Rcblx0XHR2YXIgcmdiID0gdGhpcy52YWx1ZXMucmdiO1xuXHRcdHZhciB5aXEgPSAocmdiWzBdICogMjk5ICsgcmdiWzFdICogNTg3ICsgcmdiWzJdICogMTE0KSAvIDEwMDA7XG5cdFx0cmV0dXJuIHlpcSA8IDEyODtcblx0fSxcblxuXHRsaWdodDogZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiAhdGhpcy5kYXJrKCk7XG5cdH0sXG5cblx0bmVnYXRlOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHJnYiA9IFtdO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgMzsgaSsrKSB7XG5cdFx0XHRyZ2JbaV0gPSAyNTUgLSB0aGlzLnZhbHVlcy5yZ2JbaV07XG5cdFx0fVxuXHRcdHRoaXMuc2V0VmFsdWVzKCdyZ2InLCByZ2IpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdGxpZ2h0ZW46IGZ1bmN0aW9uIChyYXRpbykge1xuXHRcdHRoaXMudmFsdWVzLmhzbFsyXSArPSB0aGlzLnZhbHVlcy5oc2xbMl0gKiByYXRpbztcblx0XHR0aGlzLnNldFZhbHVlcygnaHNsJywgdGhpcy52YWx1ZXMuaHNsKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRkYXJrZW46IGZ1bmN0aW9uIChyYXRpbykge1xuXHRcdHRoaXMudmFsdWVzLmhzbFsyXSAtPSB0aGlzLnZhbHVlcy5oc2xbMl0gKiByYXRpbztcblx0XHR0aGlzLnNldFZhbHVlcygnaHNsJywgdGhpcy52YWx1ZXMuaHNsKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRzYXR1cmF0ZTogZnVuY3Rpb24gKHJhdGlvKSB7XG5cdFx0dGhpcy52YWx1ZXMuaHNsWzFdICs9IHRoaXMudmFsdWVzLmhzbFsxXSAqIHJhdGlvO1xuXHRcdHRoaXMuc2V0VmFsdWVzKCdoc2wnLCB0aGlzLnZhbHVlcy5oc2wpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdGRlc2F0dXJhdGU6IGZ1bmN0aW9uIChyYXRpbykge1xuXHRcdHRoaXMudmFsdWVzLmhzbFsxXSAtPSB0aGlzLnZhbHVlcy5oc2xbMV0gKiByYXRpbztcblx0XHR0aGlzLnNldFZhbHVlcygnaHNsJywgdGhpcy52YWx1ZXMuaHNsKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHR3aGl0ZW46IGZ1bmN0aW9uIChyYXRpbykge1xuXHRcdHRoaXMudmFsdWVzLmh3YlsxXSArPSB0aGlzLnZhbHVlcy5od2JbMV0gKiByYXRpbztcblx0XHR0aGlzLnNldFZhbHVlcygnaHdiJywgdGhpcy52YWx1ZXMuaHdiKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRibGFja2VuOiBmdW5jdGlvbiAocmF0aW8pIHtcblx0XHR0aGlzLnZhbHVlcy5od2JbMl0gKz0gdGhpcy52YWx1ZXMuaHdiWzJdICogcmF0aW87XG5cdFx0dGhpcy5zZXRWYWx1ZXMoJ2h3YicsIHRoaXMudmFsdWVzLmh3Yik7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0Z3JleXNjYWxlOiBmdW5jdGlvbiAoKSB7XG5cdFx0dmFyIHJnYiA9IHRoaXMudmFsdWVzLnJnYjtcblx0XHQvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0dyYXlzY2FsZSNDb252ZXJ0aW5nX2NvbG9yX3RvX2dyYXlzY2FsZVxuXHRcdHZhciB2YWwgPSByZ2JbMF0gKiAwLjMgKyByZ2JbMV0gKiAwLjU5ICsgcmdiWzJdICogMC4xMTtcblx0XHR0aGlzLnNldFZhbHVlcygncmdiJywgW3ZhbCwgdmFsLCB2YWxdKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHRjbGVhcmVyOiBmdW5jdGlvbiAocmF0aW8pIHtcblx0XHR0aGlzLnNldFZhbHVlcygnYWxwaGEnLCB0aGlzLnZhbHVlcy5hbHBoYSAtICh0aGlzLnZhbHVlcy5hbHBoYSAqIHJhdGlvKSk7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH0sXG5cblx0b3BhcXVlcjogZnVuY3Rpb24gKHJhdGlvKSB7XG5cdFx0dGhpcy5zZXRWYWx1ZXMoJ2FscGhhJywgdGhpcy52YWx1ZXMuYWxwaGEgKyAodGhpcy52YWx1ZXMuYWxwaGEgKiByYXRpbykpO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9LFxuXG5cdHJvdGF0ZTogZnVuY3Rpb24gKGRlZ3JlZXMpIHtcblx0XHR2YXIgaHVlID0gdGhpcy52YWx1ZXMuaHNsWzBdO1xuXHRcdGh1ZSA9IChodWUgKyBkZWdyZWVzKSAlIDM2MDtcblx0XHRodWUgPSBodWUgPCAwID8gMzYwICsgaHVlIDogaHVlO1xuXHRcdHRoaXMudmFsdWVzLmhzbFswXSA9IGh1ZTtcblx0XHR0aGlzLnNldFZhbHVlcygnaHNsJywgdGhpcy52YWx1ZXMuaHNsKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fSxcblxuXHQvKipcblx0ICogUG9ydGVkIGZyb20gc2FzcyBpbXBsZW1lbnRhdGlvbiBpbiBDXG5cdCAqIGh0dHBzOi8vZ2l0aHViLmNvbS9zYXNzL2xpYnNhc3MvYmxvYi8wZTZiNGEyODUwMDkyMzU2YWEzZWNlMDdjNmIyNDlmMDIyMWNhY2VkL2Z1bmN0aW9ucy5jcHAjTDIwOVxuXHQgKi9cblx0bWl4OiBmdW5jdGlvbiAobWl4aW5Db2xvciwgd2VpZ2h0KSB7XG5cdFx0dmFyIGNvbG9yMSA9IHRoaXM7XG5cdFx0dmFyIGNvbG9yMiA9IG1peGluQ29sb3I7XG5cdFx0dmFyIHAgPSB3ZWlnaHQgPT09IHVuZGVmaW5lZCA/IDAuNSA6IHdlaWdodDtcblxuXHRcdHZhciB3ID0gMiAqIHAgLSAxO1xuXHRcdHZhciBhID0gY29sb3IxLmFscGhhKCkgLSBjb2xvcjIuYWxwaGEoKTtcblxuXHRcdHZhciB3MSA9ICgoKHcgKiBhID09PSAtMSkgPyB3IDogKHcgKyBhKSAvICgxICsgdyAqIGEpKSArIDEpIC8gMi4wO1xuXHRcdHZhciB3MiA9IDEgLSB3MTtcblxuXHRcdHJldHVybiB0aGlzXG5cdFx0XHQucmdiKFxuXHRcdFx0XHR3MSAqIGNvbG9yMS5yZWQoKSArIHcyICogY29sb3IyLnJlZCgpLFxuXHRcdFx0XHR3MSAqIGNvbG9yMS5ncmVlbigpICsgdzIgKiBjb2xvcjIuZ3JlZW4oKSxcblx0XHRcdFx0dzEgKiBjb2xvcjEuYmx1ZSgpICsgdzIgKiBjb2xvcjIuYmx1ZSgpXG5cdFx0XHQpXG5cdFx0XHQuYWxwaGEoY29sb3IxLmFscGhhKCkgKiBwICsgY29sb3IyLmFscGhhKCkgKiAoMSAtIHApKTtcblx0fSxcblxuXHR0b0pTT046IGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGhpcy5yZ2IoKTtcblx0fSxcblxuXHRjbG9uZTogZnVuY3Rpb24gKCkge1xuXHRcdHZhciBjb2wgPSBuZXcgQ29sb3IoKTtcblx0XHRjb2wudmFsdWVzID0gY2xvbmUodGhpcy52YWx1ZXMpO1xuXHRcdHJldHVybiBjb2w7XG5cdH1cbn07XG5cbkNvbG9yLnByb3RvdHlwZS5nZXRWYWx1ZXMgPSBmdW5jdGlvbiAoc3BhY2UpIHtcblx0dmFyIHZhbHMgPSB7fTtcblxuXHRmb3IgKHZhciBpID0gMDsgaSA8IHNwYWNlLmxlbmd0aDsgaSsrKSB7XG5cdFx0dmFsc1tzcGFjZS5jaGFyQXQoaSldID0gdGhpcy52YWx1ZXNbc3BhY2VdW2ldO1xuXHR9XG5cblx0aWYgKHRoaXMudmFsdWVzLmFscGhhICE9PSAxKSB7XG5cdFx0dmFscy5hID0gdGhpcy52YWx1ZXMuYWxwaGE7XG5cdH1cblxuXHQvLyB7cjogMjU1LCBnOiAyNTUsIGI6IDI1NSwgYTogMC40fVxuXHRyZXR1cm4gdmFscztcbn07XG5cbkNvbG9yLnByb3RvdHlwZS5zZXRWYWx1ZXMgPSBmdW5jdGlvbiAoc3BhY2UsIHZhbHMpIHtcblx0dmFyIHNwYWNlcyA9IHtcblx0XHRyZ2I6IFsncmVkJywgJ2dyZWVuJywgJ2JsdWUnXSxcblx0XHRoc2w6IFsnaHVlJywgJ3NhdHVyYXRpb24nLCAnbGlnaHRuZXNzJ10sXG5cdFx0aHN2OiBbJ2h1ZScsICdzYXR1cmF0aW9uJywgJ3ZhbHVlJ10sXG5cdFx0aHdiOiBbJ2h1ZScsICd3aGl0ZW5lc3MnLCAnYmxhY2tuZXNzJ10sXG5cdFx0Y215azogWydjeWFuJywgJ21hZ2VudGEnLCAneWVsbG93JywgJ2JsYWNrJ11cblx0fTtcblxuXHR2YXIgbWF4ZXMgPSB7XG5cdFx0cmdiOiBbMjU1LCAyNTUsIDI1NV0sXG5cdFx0aHNsOiBbMzYwLCAxMDAsIDEwMF0sXG5cdFx0aHN2OiBbMzYwLCAxMDAsIDEwMF0sXG5cdFx0aHdiOiBbMzYwLCAxMDAsIDEwMF0sXG5cdFx0Y215azogWzEwMCwgMTAwLCAxMDAsIDEwMF1cblx0fTtcblxuXHR2YXIgaTtcblx0dmFyIGFscGhhID0gMTtcblx0aWYgKHNwYWNlID09PSAnYWxwaGEnKSB7XG5cdFx0YWxwaGEgPSB2YWxzO1xuXHR9IGVsc2UgaWYgKHZhbHMubGVuZ3RoKSB7XG5cdFx0Ly8gWzEwLCAxMCwgMTBdXG5cdFx0dGhpcy52YWx1ZXNbc3BhY2VdID0gdmFscy5zbGljZSgwLCBzcGFjZS5sZW5ndGgpO1xuXHRcdGFscGhhID0gdmFsc1tzcGFjZS5sZW5ndGhdO1xuXHR9IGVsc2UgaWYgKHZhbHNbc3BhY2UuY2hhckF0KDApXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Ly8ge3I6IDEwLCBnOiAxMCwgYjogMTB9XG5cdFx0Zm9yIChpID0gMDsgaSA8IHNwYWNlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR0aGlzLnZhbHVlc1tzcGFjZV1baV0gPSB2YWxzW3NwYWNlLmNoYXJBdChpKV07XG5cdFx0fVxuXG5cdFx0YWxwaGEgPSB2YWxzLmE7XG5cdH0gZWxzZSBpZiAodmFsc1tzcGFjZXNbc3BhY2VdWzBdXSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0Ly8ge3JlZDogMTAsIGdyZWVuOiAxMCwgYmx1ZTogMTB9XG5cdFx0dmFyIGNoYW5zID0gc3BhY2VzW3NwYWNlXTtcblxuXHRcdGZvciAoaSA9IDA7IGkgPCBzcGFjZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0dGhpcy52YWx1ZXNbc3BhY2VdW2ldID0gdmFsc1tjaGFuc1tpXV07XG5cdFx0fVxuXG5cdFx0YWxwaGEgPSB2YWxzLmFscGhhO1xuXHR9XG5cblx0dGhpcy52YWx1ZXMuYWxwaGEgPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCAoYWxwaGEgPT09IHVuZGVmaW5lZCA/IHRoaXMudmFsdWVzLmFscGhhIDogYWxwaGEpKSk7XG5cblx0aWYgKHNwYWNlID09PSAnYWxwaGEnKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0dmFyIGNhcHBlZDtcblxuXHQvLyBjYXAgdmFsdWVzIG9mIHRoZSBzcGFjZSBwcmlvciBjb252ZXJ0aW5nIGFsbCB2YWx1ZXNcblx0Zm9yIChpID0gMDsgaSA8IHNwYWNlLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y2FwcGVkID0gTWF0aC5tYXgoMCwgTWF0aC5taW4obWF4ZXNbc3BhY2VdW2ldLCB0aGlzLnZhbHVlc1tzcGFjZV1baV0pKTtcblx0XHR0aGlzLnZhbHVlc1tzcGFjZV1baV0gPSBNYXRoLnJvdW5kKGNhcHBlZCk7XG5cdH1cblxuXHQvLyBjb252ZXJ0IHRvIGFsbCB0aGUgb3RoZXIgY29sb3Igc3BhY2VzXG5cdGZvciAodmFyIHNuYW1lIGluIHNwYWNlcykge1xuXHRcdGlmIChzbmFtZSAhPT0gc3BhY2UpIHtcblx0XHRcdHRoaXMudmFsdWVzW3NuYW1lXSA9IGNvbnZlcnRbc3BhY2VdW3NuYW1lXSh0aGlzLnZhbHVlc1tzcGFjZV0pO1xuXHRcdH1cblxuXHRcdC8vIGNhcCB2YWx1ZXNcblx0XHRmb3IgKGkgPSAwOyBpIDwgc25hbWUubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNhcHBlZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKG1heGVzW3NuYW1lXVtpXSwgdGhpcy52YWx1ZXNbc25hbWVdW2ldKSk7XG5cdFx0XHR0aGlzLnZhbHVlc1tzbmFtZV1baV0gPSBNYXRoLnJvdW5kKGNhcHBlZCk7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRydWU7XG59O1xuXG5Db2xvci5wcm90b3R5cGUuc2V0U3BhY2UgPSBmdW5jdGlvbiAoc3BhY2UsIGFyZ3MpIHtcblx0dmFyIHZhbHMgPSBhcmdzWzBdO1xuXG5cdGlmICh2YWxzID09PSB1bmRlZmluZWQpIHtcblx0XHQvLyBjb2xvci5yZ2IoKVxuXHRcdHJldHVybiB0aGlzLmdldFZhbHVlcyhzcGFjZSk7XG5cdH1cblxuXHQvLyBjb2xvci5yZ2IoMTAsIDEwLCAxMClcblx0aWYgKHR5cGVvZiB2YWxzID09PSAnbnVtYmVyJykge1xuXHRcdHZhbHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmdzKTtcblx0fVxuXG5cdHRoaXMuc2V0VmFsdWVzKHNwYWNlLCB2YWxzKTtcblx0cmV0dXJuIHRoaXM7XG59O1xuXG5Db2xvci5wcm90b3R5cGUuc2V0Q2hhbm5lbCA9IGZ1bmN0aW9uIChzcGFjZSwgaW5kZXgsIHZhbCkge1xuXHRpZiAodmFsID09PSB1bmRlZmluZWQpIHtcblx0XHQvLyBjb2xvci5yZWQoKVxuXHRcdHJldHVybiB0aGlzLnZhbHVlc1tzcGFjZV1baW5kZXhdO1xuXHR9IGVsc2UgaWYgKHZhbCA9PT0gdGhpcy52YWx1ZXNbc3BhY2VdW2luZGV4XSkge1xuXHRcdC8vIGNvbG9yLnJlZChjb2xvci5yZWQoKSlcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdC8vIGNvbG9yLnJlZCgxMDApXG5cdHRoaXMudmFsdWVzW3NwYWNlXVtpbmRleF0gPSB2YWw7XG5cdHRoaXMuc2V0VmFsdWVzKHNwYWNlLCB0aGlzLnZhbHVlc1tzcGFjZV0pO1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDb2xvcjtcbiIsImV4cG9ydHMucmVhZCA9IGZ1bmN0aW9uIChidWZmZXIsIG9mZnNldCwgaXNMRSwgbUxlbiwgbkJ5dGVzKSB7XG4gIHZhciBlLCBtXG4gIHZhciBlTGVuID0gbkJ5dGVzICogOCAtIG1MZW4gLSAxXG4gIHZhciBlTWF4ID0gKDEgPDwgZUxlbikgLSAxXG4gIHZhciBlQmlhcyA9IGVNYXggPj4gMVxuICB2YXIgbkJpdHMgPSAtN1xuICB2YXIgaSA9IGlzTEUgPyAobkJ5dGVzIC0gMSkgOiAwXG4gIHZhciBkID0gaXNMRSA/IC0xIDogMVxuICB2YXIgcyA9IGJ1ZmZlcltvZmZzZXQgKyBpXVxuXG4gIGkgKz0gZFxuXG4gIGUgPSBzICYgKCgxIDw8ICgtbkJpdHMpKSAtIDEpXG4gIHMgPj49ICgtbkJpdHMpXG4gIG5CaXRzICs9IGVMZW5cbiAgZm9yICg7IG5CaXRzID4gMDsgZSA9IGUgKiAyNTYgKyBidWZmZXJbb2Zmc2V0ICsgaV0sIGkgKz0gZCwgbkJpdHMgLT0gOCkge31cblxuICBtID0gZSAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBlID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBtTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IG0gPSBtICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgaWYgKGUgPT09IDApIHtcbiAgICBlID0gMSAtIGVCaWFzXG4gIH0gZWxzZSBpZiAoZSA9PT0gZU1heCkge1xuICAgIHJldHVybiBtID8gTmFOIDogKChzID8gLTEgOiAxKSAqIEluZmluaXR5KVxuICB9IGVsc2Uge1xuICAgIG0gPSBtICsgTWF0aC5wb3coMiwgbUxlbilcbiAgICBlID0gZSAtIGVCaWFzXG4gIH1cbiAgcmV0dXJuIChzID8gLTEgOiAxKSAqIG0gKiBNYXRoLnBvdygyLCBlIC0gbUxlbilcbn1cblxuZXhwb3J0cy53cml0ZSA9IGZ1bmN0aW9uIChidWZmZXIsIHZhbHVlLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbSwgY1xuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIHJ0ID0gKG1MZW4gPT09IDIzID8gTWF0aC5wb3coMiwgLTI0KSAtIE1hdGgucG93KDIsIC03NykgOiAwKVxuICB2YXIgaSA9IGlzTEUgPyAwIDogKG5CeXRlcyAtIDEpXG4gIHZhciBkID0gaXNMRSA/IDEgOiAtMVxuICB2YXIgcyA9IHZhbHVlIDwgMCB8fCAodmFsdWUgPT09IDAgJiYgMSAvIHZhbHVlIDwgMCkgPyAxIDogMFxuXG4gIHZhbHVlID0gTWF0aC5hYnModmFsdWUpXG5cbiAgaWYgKGlzTmFOKHZhbHVlKSB8fCB2YWx1ZSA9PT0gSW5maW5pdHkpIHtcbiAgICBtID0gaXNOYU4odmFsdWUpID8gMSA6IDBcbiAgICBlID0gZU1heFxuICB9IGVsc2Uge1xuICAgIGUgPSBNYXRoLmZsb29yKE1hdGgubG9nKHZhbHVlKSAvIE1hdGguTE4yKVxuICAgIGlmICh2YWx1ZSAqIChjID0gTWF0aC5wb3coMiwgLWUpKSA8IDEpIHtcbiAgICAgIGUtLVxuICAgICAgYyAqPSAyXG4gICAgfVxuICAgIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgdmFsdWUgKz0gcnQgLyBjXG4gICAgfSBlbHNlIHtcbiAgICAgIHZhbHVlICs9IHJ0ICogTWF0aC5wb3coMiwgMSAtIGVCaWFzKVxuICAgIH1cbiAgICBpZiAodmFsdWUgKiBjID49IDIpIHtcbiAgICAgIGUrK1xuICAgICAgYyAvPSAyXG4gICAgfVxuXG4gICAgaWYgKGUgKyBlQmlhcyA+PSBlTWF4KSB7XG4gICAgICBtID0gMFxuICAgICAgZSA9IGVNYXhcbiAgICB9IGVsc2UgaWYgKGUgKyBlQmlhcyA+PSAxKSB7XG4gICAgICBtID0gKHZhbHVlICogYyAtIDEpICogTWF0aC5wb3coMiwgbUxlbilcbiAgICAgIGUgPSBlICsgZUJpYXNcbiAgICB9IGVsc2Uge1xuICAgICAgbSA9IHZhbHVlICogTWF0aC5wb3coMiwgZUJpYXMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gMFxuICAgIH1cbiAgfVxuXG4gIGZvciAoOyBtTGVuID49IDg7IGJ1ZmZlcltvZmZzZXQgKyBpXSA9IG0gJiAweGZmLCBpICs9IGQsIG0gLz0gMjU2LCBtTGVuIC09IDgpIHt9XG5cbiAgZSA9IChlIDw8IG1MZW4pIHwgbVxuICBlTGVuICs9IG1MZW5cbiAgZm9yICg7IGVMZW4gPiAwOyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBlICYgMHhmZiwgaSArPSBkLCBlIC89IDI1NiwgZUxlbiAtPSA4KSB7fVxuXG4gIGJ1ZmZlcltvZmZzZXQgKyBpIC0gZF0gfD0gcyAqIDEyOFxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBbXG5cdCcjMDE4ODhDJywgLy8gdGVhbFxuICAnI0ZDNzUwMCcsIC8vIGJyaWdodCBvcmFuZ2VcbiAgJyMwMzRGNUQnLCAvLyBkYXJrIHRlYWxcbiAgJyNGNzNGMDEnLCAvLyBvcmFuZ2VyZWRcbiAgJyNGQzE5NjAnLCAvLyBtYWdlbnRhXG4gICcjQzcxNDRDJywgLy8gcmFzcGJlcnJ5XG4gICcjRjNDMTAwJywgLy8gZ29sZGVucm9kXG4gICcjMTU5OEYyJywgLy8gbGlnaHRuaW5nIGJsdWVcbiAgJyMyNDY1RTEnLCAvLyBzYWlsIGJsdWVcbiAgJyNGMTlFMDInLCAvLyBnb2xkXG5dXG4iLCJ2YXIgTWVyc2VubmVUd2lzdGVyID0gcmVxdWlyZSgnbWVyc2VubmUtdHdpc3RlcicpO1xudmFyIHBhcGVyR2VuID0gcmVxdWlyZSgnLi9wYXBlcicpXG52YXIgQ29sb3IgPSByZXF1aXJlKCdjb2xvcicpXG52YXIgY29sb3JzID0gcmVxdWlyZSgnLi9jb2xvcnMnKVxudmFyIHNoYXBlQ291bnQgPSA0XG5cbm1vZHVsZS5leHBvcnRzID0gZ2VuZXJhdGVJZGVudGljb25cblxudmFyIGdlbmVyYXRvclxuZnVuY3Rpb24gZ2VuZXJhdGVJZGVudGljb24oZGlhbWV0ZXIsIHNlZWQpIHtcbiAgZ2VuZXJhdG9yID0gbmV3IE1lcnNlbm5lVHdpc3RlcihzZWVkKTtcblxuICB2YXIgZWxlbWVudHMgPSBwYXBlckdlbihkaWFtZXRlcilcbiAgdmFyIHBhcGVyID0gZWxlbWVudHMucGFwZXJcbiAgdmFyIGNvbnRhaW5lciA9IGVsZW1lbnRzLmNvbnRhaW5lclxuXG4gIHZhciByZW1haW5pbmdDb2xvcnMgPSBodWVTaGlmdChjb2xvcnMuc2xpY2UoKSwgZ2VuZXJhdG9yKVxuXG5cbiAgdmFyIGJrZ25kID0gcGFwZXIucmVjdCgwLCAwLCBkaWFtZXRlciwgZGlhbWV0ZXIpO1xuICBia2duZC5hdHRyKFwiZmlsbFwiLCBnZW5Db2xvcihyZW1haW5pbmdDb2xvcnMpKTtcbiAgYmtnbmQuYXR0cignc3Ryb2tlJywgJ25vbmUnKTtcblxuICBmb3IodmFyIGkgPSAwOyBpIDwgc2hhcGVDb3VudCAtIDE7IGkrKykge1xuICAgIGdlblNoYXBlKHBhcGVyLCByZW1haW5pbmdDb2xvcnMsIGRpYW1ldGVyLCBpLCBzaGFwZUNvdW50IC0gMSlcbiAgfVxuXG4gIHJldHVybiBjb250YWluZXJcbn1cblxuZnVuY3Rpb24gZ2VuU2hhcGUocGFwZXIsIHJlbWFpbmluZ0NvbG9ycywgZGlhbWV0ZXIsIGksIHRvdGFsKSB7XG4gIHZhciBzaGFwZSA9IHBhcGVyLnJlY3QoMCwgMCwgZGlhbWV0ZXIsIGRpYW1ldGVyKTtcbiAgc2hhcGUucm90YXRlKDM2MCAqIGdlbmVyYXRvci5yYW5kb20oKSlcblxuICB2YXIgdHJhbnMgPSBkaWFtZXRlciAvIHRvdGFsICogZ2VuZXJhdG9yLnJhbmRvbSgpICsgKGkgKiBkaWFtZXRlciAvIHRvdGFsKVxuICBzaGFwZS50cmFuc2xhdGUodHJhbnMpXG5cbiAgc2hhcGUucm90YXRlKDE4MCAqIGdlbmVyYXRvci5yYW5kb20oKSlcbiAgc2hhcGUuYXR0cignZmlsbCcsIGdlbkNvbG9yKHJlbWFpbmluZ0NvbG9ycykpO1xuICBzaGFwZS5hdHRyKCdzdHJva2UnLCAnbm9uZScpO1xufVxuXG5mdW5jdGlvbiBnZW5Db2xvcihjb2xvcnMpIHtcbiAgdmFyIHJhbmQgPSBnZW5lcmF0b3IucmFuZG9tKClcbiAgdmFyIGlkeCA9IE1hdGguZmxvb3IoY29sb3JzLmxlbmd0aCAqIGdlbmVyYXRvci5yYW5kb20oKSlcbiAgdmFyIGNvbG9yID0gY29sb3JzLnNwbGljZShpZHgsMSlbMF1cbiAgcmV0dXJuIGNvbG9yXG59XG5cbnZhciB3b2JibGUgPSAzMFxuZnVuY3Rpb24gaHVlU2hpZnQoY29sb3JzLCBnZW5lcmF0b3IpIHtcbiAgdmFyIGFtb3VudCA9IChnZW5lcmF0b3IucmFuZG9tKCkgKiAzMCkgLSAod29iYmxlIC8gMilcbiAgcmV0dXJuIGNvbG9ycy5tYXAoZnVuY3Rpb24oaGV4KSB7XG4gICAgdmFyIGNvbG9yID0gQ29sb3IoaGV4KVxuICAgIGNvbG9yLnJvdGF0ZShhbW91bnQpXG4gICAgcmV0dXJuIGNvbG9yLmhleFN0cmluZygpXG4gIH0pXG59XG4iLCJ2YXIgUmFwaGFlbCA9IHJlcXVpcmUoJ3JhcGhhZWwnKVxuXG5mdW5jdGlvbiBuZXdQYXBlcihkaWFtZXRlcikge1xuICB2YXIgY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2JylcbiAgY29udGFpbmVyLnN0eWxlLmJvcmRlclJhZGl1cyA9ICc1MHB4J1xuICBjb250YWluZXIuc3R5bGUub3ZlcmZsb3cgPSAnaGlkZGVuJ1xuICBjb250YWluZXIuc3R5bGUucGFkZGluZyA9ICcwcHgnXG4gIGNvbnRhaW5lci5zdHlsZS5tYXJnaW4gPSAnMHB4J1xuICBjb250YWluZXIuc3R5bGUud2lkdGggPSAnJyArIGRpYW1ldGVyICsgJ3B4J1xuICBjb250YWluZXIuc3R5bGUuaGVpZ2h0ID0gJycgKyBkaWFtZXRlciArICdweCdcbiAgY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJ1xuICB2YXIgcGFwZXIgPSBSYXBoYWVsKGNvbnRhaW5lciwgMTAwLCAxMDApO1xuICByZXR1cm4ge1xuICAgIHBhcGVyOiBwYXBlcixcbiAgICBjb250YWluZXI6IGNvbnRhaW5lcixcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG5ld1BhcGVyXG4iLCIvKlxuICBodHRwczovL2dpdGh1Yi5jb20vYmFua3NlYW4gd3JhcHBlZCBNYWtvdG8gTWF0c3Vtb3RvIGFuZCBUYWt1amkgTmlzaGltdXJhJ3MgY29kZSBpbiBhIG5hbWVzcGFjZVxuICBzbyBpdCdzIGJldHRlciBlbmNhcHN1bGF0ZWQuIE5vdyB5b3UgY2FuIGhhdmUgbXVsdGlwbGUgcmFuZG9tIG51bWJlciBnZW5lcmF0b3JzXG4gIGFuZCB0aGV5IHdvbid0IHN0b21wIGFsbCBvdmVyIGVhY2hvdGhlcidzIHN0YXRlLlxuICBcbiAgSWYgeW91IHdhbnQgdG8gdXNlIHRoaXMgYXMgYSBzdWJzdGl0dXRlIGZvciBNYXRoLnJhbmRvbSgpLCB1c2UgdGhlIHJhbmRvbSgpXG4gIG1ldGhvZCBsaWtlIHNvOlxuICBcbiAgdmFyIG0gPSBuZXcgTWVyc2VubmVUd2lzdGVyKCk7XG4gIHZhciByYW5kb21OdW1iZXIgPSBtLnJhbmRvbSgpO1xuICBcbiAgWW91IGNhbiBhbHNvIGNhbGwgdGhlIG90aGVyIGdlbnJhbmRfe2Zvb30oKSBtZXRob2RzIG9uIHRoZSBpbnN0YW5jZS5cbiBcbiAgSWYgeW91IHdhbnQgdG8gdXNlIGEgc3BlY2lmaWMgc2VlZCBpbiBvcmRlciB0byBnZXQgYSByZXBlYXRhYmxlIHJhbmRvbVxuICBzZXF1ZW5jZSwgcGFzcyBhbiBpbnRlZ2VyIGludG8gdGhlIGNvbnN0cnVjdG9yOlxuIFxuICB2YXIgbSA9IG5ldyBNZXJzZW5uZVR3aXN0ZXIoMTIzKTtcbiBcbiAgYW5kIHRoYXQgd2lsbCBhbHdheXMgcHJvZHVjZSB0aGUgc2FtZSByYW5kb20gc2VxdWVuY2UuXG4gXG4gIFNlYW4gTWNDdWxsb3VnaCAoYmFua3NlYW5AZ21haWwuY29tKVxuKi9cbiBcbi8qIFxuICAgQSBDLXByb2dyYW0gZm9yIE1UMTk5MzcsIHdpdGggaW5pdGlhbGl6YXRpb24gaW1wcm92ZWQgMjAwMi8xLzI2LlxuICAgQ29kZWQgYnkgVGFrdWppIE5pc2hpbXVyYSBhbmQgTWFrb3RvIE1hdHN1bW90by5cbiBcbiAgIEJlZm9yZSB1c2luZywgaW5pdGlhbGl6ZSB0aGUgc3RhdGUgYnkgdXNpbmcgaW5pdF9zZWVkKHNlZWQpICBcbiAgIG9yIGluaXRfYnlfYXJyYXkoaW5pdF9rZXksIGtleV9sZW5ndGgpLlxuIFxuICAgQ29weXJpZ2h0IChDKSAxOTk3IC0gMjAwMiwgTWFrb3RvIE1hdHN1bW90byBhbmQgVGFrdWppIE5pc2hpbXVyYSxcbiAgIEFsbCByaWdodHMgcmVzZXJ2ZWQuICAgICAgICAgICAgICAgICAgICAgICAgICBcbiBcbiAgIFJlZGlzdHJpYnV0aW9uIGFuZCB1c2UgaW4gc291cmNlIGFuZCBiaW5hcnkgZm9ybXMsIHdpdGggb3Igd2l0aG91dFxuICAgbW9kaWZpY2F0aW9uLCBhcmUgcGVybWl0dGVkIHByb3ZpZGVkIHRoYXQgdGhlIGZvbGxvd2luZyBjb25kaXRpb25zXG4gICBhcmUgbWV0OlxuIFxuICAgICAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICAgICAgICBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nIGRpc2NsYWltZXIuXG4gXG4gICAgIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmUgY29weXJpZ2h0XG4gICAgICAgIG5vdGljZSwgdGhpcyBsaXN0IG9mIGNvbmRpdGlvbnMgYW5kIHRoZSBmb2xsb3dpbmcgZGlzY2xhaW1lciBpbiB0aGVcbiAgICAgICAgZG9jdW1lbnRhdGlvbiBhbmQvb3Igb3RoZXIgbWF0ZXJpYWxzIHByb3ZpZGVkIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiBcbiAgICAgMy4gVGhlIG5hbWVzIG9mIGl0cyBjb250cmlidXRvcnMgbWF5IG5vdCBiZSB1c2VkIHRvIGVuZG9yc2Ugb3IgcHJvbW90ZSBcbiAgICAgICAgcHJvZHVjdHMgZGVyaXZlZCBmcm9tIHRoaXMgc29mdHdhcmUgd2l0aG91dCBzcGVjaWZpYyBwcmlvciB3cml0dGVuIFxuICAgICAgICBwZXJtaXNzaW9uLlxuIFxuICAgVEhJUyBTT0ZUV0FSRSBJUyBQUk9WSURFRCBCWSBUSEUgQ09QWVJJR0hUIEhPTERFUlMgQU5EIENPTlRSSUJVVE9SU1xuICAgXCJBUyBJU1wiIEFORCBBTlkgRVhQUkVTUyBPUiBJTVBMSUVEIFdBUlJBTlRJRVMsIElOQ0xVRElORywgQlVUIE5PVFxuICAgTElNSVRFRCBUTywgVEhFIElNUExJRUQgV0FSUkFOVElFUyBPRiBNRVJDSEFOVEFCSUxJVFkgQU5EIEZJVE5FU1MgRk9SXG4gICBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBUkUgRElTQ0xBSU1FRC4gIElOIE5PIEVWRU5UIFNIQUxMIFRIRSBDT1BZUklHSFQgT1dORVIgT1JcbiAgIENPTlRSSUJVVE9SUyBCRSBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLFxuICAgRVhFTVBMQVJZLCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLFxuICAgUFJPQ1VSRU1FTlQgT0YgU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SXG4gICBQUk9GSVRTOyBPUiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GXG4gICBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElOR1xuICAgTkVHTElHRU5DRSBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTXG4gICBTT0ZUV0FSRSwgRVZFTiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiBcbiBcbiAgIEFueSBmZWVkYmFjayBpcyB2ZXJ5IHdlbGNvbWUuXG4gICBodHRwOi8vd3d3Lm1hdGguc2NpLmhpcm9zaGltYS11LmFjLmpwL35tLW1hdC9NVC9lbXQuaHRtbFxuICAgZW1haWw6IG0tbWF0IEAgbWF0aC5zY2kuaGlyb3NoaW1hLXUuYWMuanAgKHJlbW92ZSBzcGFjZSlcbiovXG4gXG52YXIgTWVyc2VubmVUd2lzdGVyID0gZnVuY3Rpb24oc2VlZCkge1xuXHRpZiAoc2VlZCA9PSB1bmRlZmluZWQpIHtcblx0XHRzZWVkID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdH0gXG5cblx0LyogUGVyaW9kIHBhcmFtZXRlcnMgKi8gIFxuXHR0aGlzLk4gPSA2MjQ7XG5cdHRoaXMuTSA9IDM5Nztcblx0dGhpcy5NQVRSSVhfQSA9IDB4OTkwOGIwZGY7ICAgLyogY29uc3RhbnQgdmVjdG9yIGEgKi9cblx0dGhpcy5VUFBFUl9NQVNLID0gMHg4MDAwMDAwMDsgLyogbW9zdCBzaWduaWZpY2FudCB3LXIgYml0cyAqL1xuXHR0aGlzLkxPV0VSX01BU0sgPSAweDdmZmZmZmZmOyAvKiBsZWFzdCBzaWduaWZpY2FudCByIGJpdHMgKi9cblxuXHR0aGlzLm10ID0gbmV3IEFycmF5KHRoaXMuTik7IC8qIHRoZSBhcnJheSBmb3IgdGhlIHN0YXRlIHZlY3RvciAqL1xuXHR0aGlzLm10aT10aGlzLk4rMTsgLyogbXRpPT1OKzEgbWVhbnMgbXRbTl0gaXMgbm90IGluaXRpYWxpemVkICovXG5cblx0dGhpcy5pbml0X3NlZWQoc2VlZCk7XG59ICBcblxuLyogaW5pdGlhbGl6ZXMgbXRbTl0gd2l0aCBhIHNlZWQgKi9cbi8qIG9yaWdpbiBuYW1lIGluaXRfZ2VucmFuZCAqL1xuTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5pbml0X3NlZWQgPSBmdW5jdGlvbihzKSB7XG5cdHRoaXMubXRbMF0gPSBzID4+PiAwO1xuXHRmb3IgKHRoaXMubXRpPTE7IHRoaXMubXRpPHRoaXMuTjsgdGhpcy5tdGkrKykge1xuXHRcdHZhciBzID0gdGhpcy5tdFt0aGlzLm10aS0xXSBeICh0aGlzLm10W3RoaXMubXRpLTFdID4+PiAzMCk7XG5cdFx0dGhpcy5tdFt0aGlzLm10aV0gPSAoKCgoKHMgJiAweGZmZmYwMDAwKSA+Pj4gMTYpICogMTgxMjQzMzI1MykgPDwgMTYpICsgKHMgJiAweDAwMDBmZmZmKSAqIDE4MTI0MzMyNTMpXG5cdFx0KyB0aGlzLm10aTtcblx0XHQvKiBTZWUgS251dGggVEFPQ1AgVm9sMi4gM3JkIEVkLiBQLjEwNiBmb3IgbXVsdGlwbGllci4gKi9cblx0XHQvKiBJbiB0aGUgcHJldmlvdXMgdmVyc2lvbnMsIE1TQnMgb2YgdGhlIHNlZWQgYWZmZWN0ICAgKi9cblx0XHQvKiBvbmx5IE1TQnMgb2YgdGhlIGFycmF5IG10W10uICAgICAgICAgICAgICAgICAgICAgICAgKi9cblx0XHQvKiAyMDAyLzAxLzA5IG1vZGlmaWVkIGJ5IE1ha290byBNYXRzdW1vdG8gICAgICAgICAgICAgKi9cblx0XHR0aGlzLm10W3RoaXMubXRpXSA+Pj49IDA7XG5cdFx0LyogZm9yID4zMiBiaXQgbWFjaGluZXMgKi9cblx0fVxufVxuXG4vKiBpbml0aWFsaXplIGJ5IGFuIGFycmF5IHdpdGggYXJyYXktbGVuZ3RoICovXG4vKiBpbml0X2tleSBpcyB0aGUgYXJyYXkgZm9yIGluaXRpYWxpemluZyBrZXlzICovXG4vKiBrZXlfbGVuZ3RoIGlzIGl0cyBsZW5ndGggKi9cbi8qIHNsaWdodCBjaGFuZ2UgZm9yIEMrKywgMjAwNC8yLzI2ICovXG5NZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmluaXRfYnlfYXJyYXkgPSBmdW5jdGlvbihpbml0X2tleSwga2V5X2xlbmd0aCkge1xuXHR2YXIgaSwgaiwgaztcblx0dGhpcy5pbml0X3NlZWQoMTk2NTAyMTgpO1xuXHRpPTE7IGo9MDtcblx0ayA9ICh0aGlzLk4+a2V5X2xlbmd0aCA/IHRoaXMuTiA6IGtleV9sZW5ndGgpO1xuXHRmb3IgKDsgazsgay0tKSB7XG5cdFx0dmFyIHMgPSB0aGlzLm10W2ktMV0gXiAodGhpcy5tdFtpLTFdID4+PiAzMClcblx0XHR0aGlzLm10W2ldID0gKHRoaXMubXRbaV0gXiAoKCgoKHMgJiAweGZmZmYwMDAwKSA+Pj4gMTYpICogMTY2NDUyNSkgPDwgMTYpICsgKChzICYgMHgwMDAwZmZmZikgKiAxNjY0NTI1KSkpXG5cdFx0KyBpbml0X2tleVtqXSArIGo7IC8qIG5vbiBsaW5lYXIgKi9cblx0XHR0aGlzLm10W2ldID4+Pj0gMDsgLyogZm9yIFdPUkRTSVpFID4gMzIgbWFjaGluZXMgKi9cblx0XHRpKys7IGorKztcblx0XHRpZiAoaT49dGhpcy5OKSB7IHRoaXMubXRbMF0gPSB0aGlzLm10W3RoaXMuTi0xXTsgaT0xOyB9XG5cdFx0aWYgKGo+PWtleV9sZW5ndGgpIGo9MDtcblx0fVxuXHRmb3IgKGs9dGhpcy5OLTE7IGs7IGstLSkge1xuXHRcdHZhciBzID0gdGhpcy5tdFtpLTFdIF4gKHRoaXMubXRbaS0xXSA+Pj4gMzApO1xuXHRcdHRoaXMubXRbaV0gPSAodGhpcy5tdFtpXSBeICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxNTY2MDgzOTQxKSA8PCAxNikgKyAocyAmIDB4MDAwMGZmZmYpICogMTU2NjA4Mzk0MSkpXG5cdFx0LSBpOyAvKiBub24gbGluZWFyICovXG5cdFx0dGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXG5cdFx0aSsrO1xuXHRcdGlmIChpPj10aGlzLk4pIHsgdGhpcy5tdFswXSA9IHRoaXMubXRbdGhpcy5OLTFdOyBpPTE7IH1cblx0fVxuXG5cdHRoaXMubXRbMF0gPSAweDgwMDAwMDAwOyAvKiBNU0IgaXMgMTsgYXNzdXJpbmcgbm9uLXplcm8gaW5pdGlhbCBhcnJheSAqLyBcbn1cblxuLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwweGZmZmZmZmZmXS1pbnRlcnZhbCAqL1xuLyogb3JpZ2luIG5hbWUgZ2VucmFuZF9pbnQzMiAqL1xuTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5yYW5kb21faW50ID0gZnVuY3Rpb24oKSB7XG5cdHZhciB5O1xuXHR2YXIgbWFnMDEgPSBuZXcgQXJyYXkoMHgwLCB0aGlzLk1BVFJJWF9BKTtcblx0LyogbWFnMDFbeF0gPSB4ICogTUFUUklYX0EgIGZvciB4PTAsMSAqL1xuXG5cdGlmICh0aGlzLm10aSA+PSB0aGlzLk4pIHsgLyogZ2VuZXJhdGUgTiB3b3JkcyBhdCBvbmUgdGltZSAqL1xuXHRcdHZhciBraztcblxuXHRcdGlmICh0aGlzLm10aSA9PSB0aGlzLk4rMSkgIC8qIGlmIGluaXRfc2VlZCgpIGhhcyBub3QgYmVlbiBjYWxsZWQsICovXG5cdFx0XHR0aGlzLmluaXRfc2VlZCg1NDg5KTsgIC8qIGEgZGVmYXVsdCBpbml0aWFsIHNlZWQgaXMgdXNlZCAqL1xuXG5cdFx0Zm9yIChraz0wO2trPHRoaXMuTi10aGlzLk07a2srKykge1xuXHRcdFx0eSA9ICh0aGlzLm10W2trXSZ0aGlzLlVQUEVSX01BU0spfCh0aGlzLm10W2trKzFdJnRoaXMuTE9XRVJfTUFTSyk7XG5cdFx0XHR0aGlzLm10W2trXSA9IHRoaXMubXRba2srdGhpcy5NXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xuXHRcdH1cblx0XHRmb3IgKDtrazx0aGlzLk4tMTtraysrKSB7XG5cdFx0XHR5ID0gKHRoaXMubXRba2tdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRba2srMV0mdGhpcy5MT1dFUl9NQVNLKTtcblx0XHRcdHRoaXMubXRba2tdID0gdGhpcy5tdFtraysodGhpcy5NLXRoaXMuTildIF4gKHkgPj4+IDEpIF4gbWFnMDFbeSAmIDB4MV07XG5cdFx0fVxuXHRcdHkgPSAodGhpcy5tdFt0aGlzLk4tMV0mdGhpcy5VUFBFUl9NQVNLKXwodGhpcy5tdFswXSZ0aGlzLkxPV0VSX01BU0spO1xuXHRcdHRoaXMubXRbdGhpcy5OLTFdID0gdGhpcy5tdFt0aGlzLk0tMV0gXiAoeSA+Pj4gMSkgXiBtYWcwMVt5ICYgMHgxXTtcblxuXHRcdHRoaXMubXRpID0gMDtcblx0fVxuXG5cdHkgPSB0aGlzLm10W3RoaXMubXRpKytdO1xuXG5cdC8qIFRlbXBlcmluZyAqL1xuXHR5IF49ICh5ID4+PiAxMSk7XG5cdHkgXj0gKHkgPDwgNykgJiAweDlkMmM1NjgwO1xuXHR5IF49ICh5IDw8IDE1KSAmIDB4ZWZjNjAwMDA7XG5cdHkgXj0gKHkgPj4+IDE4KTtcblxuXHRyZXR1cm4geSA+Pj4gMDtcbn1cblxuLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwweDdmZmZmZmZmXS1pbnRlcnZhbCAqL1xuLyogb3JpZ2luIG5hbWUgZ2VucmFuZF9pbnQzMSAqL1xuTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5yYW5kb21faW50MzEgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuICh0aGlzLnJhbmRvbV9pbnQoKT4+PjEpO1xufVxuXG4vKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDFdLXJlYWwtaW50ZXJ2YWwgKi9cbi8qIG9yaWdpbiBuYW1lIGdlbnJhbmRfcmVhbDEgKi9cbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUucmFuZG9tX2luY2wgPSBmdW5jdGlvbigpIHtcblx0cmV0dXJuIHRoaXMucmFuZG9tX2ludCgpKigxLjAvNDI5NDk2NzI5NS4wKTsgXG5cdC8qIGRpdmlkZWQgYnkgMl4zMi0xICovIFxufVxuXG4vKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDEpLXJlYWwtaW50ZXJ2YWwgKi9cbk1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUucmFuZG9tID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiB0aGlzLnJhbmRvbV9pbnQoKSooMS4wLzQyOTQ5NjcyOTYuMCk7IFxuXHQvKiBkaXZpZGVkIGJ5IDJeMzIgKi9cbn1cblxuLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiAoMCwxKS1yZWFsLWludGVydmFsICovXG4vKiBvcmlnaW4gbmFtZSBnZW5yYW5kX3JlYWwzICovXG5NZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLnJhbmRvbV9leGNsID0gZnVuY3Rpb24oKSB7XG5cdHJldHVybiAodGhpcy5yYW5kb21faW50KCkgKyAwLjUpKigxLjAvNDI5NDk2NzI5Ni4wKTsgXG5cdC8qIGRpdmlkZWQgYnkgMl4zMiAqL1xufVxuXG4vKiBnZW5lcmF0ZXMgYSByYW5kb20gbnVtYmVyIG9uIFswLDEpIHdpdGggNTMtYml0IHJlc29sdXRpb24qL1xuLyogb3JpZ2luIG5hbWUgZ2VucmFuZF9yZXM1MyAqL1xuTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5yYW5kb21fbG9uZyA9IGZ1bmN0aW9uKCkgeyBcblx0dmFyIGE9dGhpcy5yYW5kb21faW50KCk+Pj41LCBiPXRoaXMucmFuZG9tX2ludCgpPj4+NjsgXG5cdHJldHVybihhKjY3MTA4ODY0LjArYikqKDEuMC85MDA3MTk5MjU0NzQwOTkyLjApOyBcbn0gXG5cbi8qIFRoZXNlIHJlYWwgdmVyc2lvbnMgYXJlIGR1ZSB0byBJc2FrdSBXYWRhLCAyMDAyLzAxLzA5IGFkZGVkICovXG5cbm1vZHVsZS5leHBvcnRzID0gTWVyc2VubmVUd2lzdGVyO1xuIiwiIWZ1bmN0aW9uIHQoZSxyKXtcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cyYmXCJvYmplY3RcIj09dHlwZW9mIG1vZHVsZT9tb2R1bGUuZXhwb3J0cz1yKCk6XCJmdW5jdGlvblwiPT10eXBlb2YgZGVmaW5lJiZkZWZpbmUuYW1kP2RlZmluZShbXSxyKTpcIm9iamVjdFwiPT10eXBlb2YgZXhwb3J0cz9leHBvcnRzLlJhcGhhZWw9cigpOmUuUmFwaGFlbD1yKCl9KHRoaXMsZnVuY3Rpb24oKXtyZXR1cm4gZnVuY3Rpb24odCl7ZnVuY3Rpb24gZShpKXtpZihyW2ldKXJldHVybiByW2ldLmV4cG9ydHM7dmFyIG49cltpXT17ZXhwb3J0czp7fSxpZDppLGxvYWRlZDohMX07cmV0dXJuIHRbaV0uY2FsbChuLmV4cG9ydHMsbixuLmV4cG9ydHMsZSksbi5sb2FkZWQ9ITAsbi5leHBvcnRzfXZhciByPXt9O3JldHVybiBlLm09dCxlLmM9cixlLnA9XCJcIixlKDApfShbZnVuY3Rpb24odCxlLHIpe3ZhciBpLG47aT1bcigxKSxyKDMpLHIoNCldLG49ZnVuY3Rpb24odCl7cmV0dXJuIHR9LmFwcGx5KGUsaSksISh2b2lkIDAhPT1uJiYodC5leHBvcnRzPW4pKX0sZnVuY3Rpb24odCxlLHIpe3ZhciBpLG47aT1bcigyKV0sbj1mdW5jdGlvbih0KXtmdW5jdGlvbiBlKHIpe2lmKGUuaXMocixcImZ1bmN0aW9uXCIpKXJldHVybiB3P3IoKTp0Lm9uKFwicmFwaGFlbC5ET01sb2FkXCIscik7aWYoZS5pcyhyLFEpKXJldHVybiBlLl9lbmdpbmUuY3JlYXRlW3pdKGUsci5zcGxpY2UoMCwzK2UuaXMoclswXSwkKSkpLmFkZChyKTt2YXIgaT1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMCk7aWYoZS5pcyhpW2kubGVuZ3RoLTFdLFwiZnVuY3Rpb25cIikpe3ZhciBuPWkucG9wKCk7cmV0dXJuIHc/bi5jYWxsKGUuX2VuZ2luZS5jcmVhdGVbel0oZSxpKSk6dC5vbihcInJhcGhhZWwuRE9NbG9hZFwiLGZ1bmN0aW9uKCl7bi5jYWxsKGUuX2VuZ2luZS5jcmVhdGVbel0oZSxpKSl9KX1yZXR1cm4gZS5fZW5naW5lLmNyZWF0ZVt6XShlLGFyZ3VtZW50cyl9ZnVuY3Rpb24gcih0KXtpZihcImZ1bmN0aW9uXCI9PXR5cGVvZiB0fHxPYmplY3QodCkhPT10KXJldHVybiB0O3ZhciBlPW5ldyB0LmNvbnN0cnVjdG9yO2Zvcih2YXIgaSBpbiB0KXRbVF0oaSkmJihlW2ldPXIodFtpXSkpO3JldHVybiBlfWZ1bmN0aW9uIGkodCxlKXtmb3IodmFyIHI9MCxpPXQubGVuZ3RoO2k+cjtyKyspaWYodFtyXT09PWUpcmV0dXJuIHQucHVzaCh0LnNwbGljZShyLDEpWzBdKX1mdW5jdGlvbiBuKHQsZSxyKXtmdW5jdGlvbiBuKCl7dmFyIGE9QXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLDApLHM9YS5qb2luKFwi4pCAXCIpLG89bi5jYWNoZT1uLmNhY2hlfHx7fSxsPW4uY291bnQ9bi5jb3VudHx8W107cmV0dXJuIG9bVF0ocyk/KGkobCxzKSxyP3Iob1tzXSk6b1tzXSk6KGwubGVuZ3RoPj0xZTMmJmRlbGV0ZSBvW2wuc2hpZnQoKV0sbC5wdXNoKHMpLG9bc109dFt6XShlLGEpLHI/cihvW3NdKTpvW3NdKX1yZXR1cm4gbn1mdW5jdGlvbiBhKCl7cmV0dXJuIHRoaXMuaGV4fWZ1bmN0aW9uIHModCxlKXtmb3IodmFyIHI9W10saT0wLG49dC5sZW5ndGg7bi0yKiFlPmk7aSs9Mil7dmFyIGE9W3t4Oit0W2ktMl0seTordFtpLTFdfSx7eDordFtpXSx5Oit0W2krMV19LHt4Oit0W2krMl0seTordFtpKzNdfSx7eDordFtpKzRdLHk6K3RbaSs1XX1dO2U/aT9uLTQ9PWk/YVszXT17eDordFswXSx5Oit0WzFdfTpuLTI9PWkmJihhWzJdPXt4Oit0WzBdLHk6K3RbMV19LGFbM109e3g6K3RbMl0seTordFszXX0pOmFbMF09e3g6K3Rbbi0yXSx5Oit0W24tMV19Om4tND09aT9hWzNdPWFbMl06aXx8KGFbMF09e3g6K3RbaV0seTordFtpKzFdfSksci5wdXNoKFtcIkNcIiwoLWFbMF0ueCs2KmFbMV0ueCthWzJdLngpLzYsKC1hWzBdLnkrNiphWzFdLnkrYVsyXS55KS82LChhWzFdLngrNiphWzJdLngtYVszXS54KS82LChhWzFdLnkrNiphWzJdLnktYVszXS55KS82LGFbMl0ueCxhWzJdLnldKX1yZXR1cm4gcn1mdW5jdGlvbiBvKHQsZSxyLGksbil7dmFyIGE9LTMqZSs5KnItOSppKzMqbixzPXQqYSs2KmUtMTIqcis2Kmk7cmV0dXJuIHQqcy0zKmUrMypyfWZ1bmN0aW9uIGwodCxlLHIsaSxuLGEscyxsLGgpe251bGw9PWgmJihoPTEpLGg9aD4xPzE6MD5oPzA6aDtmb3IodmFyIHU9aC8yLGM9MTIsZj1bLS4xMjUyLC4xMjUyLC0uMzY3OCwuMzY3OCwtLjU4NzMsLjU4NzMsLS43Njk5LC43Njk5LC0uOTA0MSwuOTA0MSwtLjk4MTYsLjk4MTZdLHA9Wy4yNDkxLC4yNDkxLC4yMzM1LC4yMzM1LC4yMDMyLC4yMDMyLC4xNjAxLC4xNjAxLC4xMDY5LC4xMDY5LC4wNDcyLC4wNDcyXSxkPTAsZz0wO2M+ZztnKyspe3ZhciB4PXUqZltnXSt1LHY9byh4LHQscixuLHMpLHk9byh4LGUsaSxhLGwpLG09dip2K3kqeTtkKz1wW2ddKlkuc3FydChtKX1yZXR1cm4gdSpkfWZ1bmN0aW9uIGgodCxlLHIsaSxuLGEscyxvLGgpe2lmKCEoMD5ofHxsKHQsZSxyLGksbixhLHMsbyk8aCkpe3ZhciB1PTEsYz11LzIsZj11LWMscCxkPS4wMTtmb3IocD1sKHQsZSxyLGksbixhLHMsbyxmKTtIKHAtaCk+ZDspYy89MixmKz0oaD5wPzE6LTEpKmMscD1sKHQsZSxyLGksbixhLHMsbyxmKTtyZXR1cm4gZn19ZnVuY3Rpb24gdSh0LGUscixpLG4sYSxzLG8pe2lmKCEoVyh0LHIpPEcobixzKXx8Ryh0LHIpPlcobixzKXx8VyhlLGkpPEcoYSxvKXx8RyhlLGkpPlcoYSxvKSkpe3ZhciBsPSh0KmktZSpyKSoobi1zKS0odC1yKSoobipvLWEqcyksaD0odCppLWUqcikqKGEtbyktKGUtaSkqKG4qby1hKnMpLHU9KHQtcikqKGEtbyktKGUtaSkqKG4tcyk7aWYodSl7dmFyIGM9bC91LGY9aC91LHA9K2MudG9GaXhlZCgyKSxkPStmLnRvRml4ZWQoMik7aWYoIShwPCtHKHQscikudG9GaXhlZCgyKXx8cD4rVyh0LHIpLnRvRml4ZWQoMil8fHA8K0cobixzKS50b0ZpeGVkKDIpfHxwPitXKG4scykudG9GaXhlZCgyKXx8ZDwrRyhlLGkpLnRvRml4ZWQoMil8fGQ+K1coZSxpKS50b0ZpeGVkKDIpfHxkPCtHKGEsbykudG9GaXhlZCgyKXx8ZD4rVyhhLG8pLnRvRml4ZWQoMikpKXJldHVybnt4OmMseTpmfX19fWZ1bmN0aW9uIGModCxlKXtyZXR1cm4gcCh0LGUpfWZ1bmN0aW9uIGYodCxlKXtyZXR1cm4gcCh0LGUsMSl9ZnVuY3Rpb24gcCh0LHIsaSl7dmFyIG49ZS5iZXppZXJCQm94KHQpLGE9ZS5iZXppZXJCQm94KHIpO2lmKCFlLmlzQkJveEludGVyc2VjdChuLGEpKXJldHVybiBpPzA6W107Zm9yKHZhciBzPWwuYXBwbHkoMCx0KSxvPWwuYXBwbHkoMCxyKSxoPVcofn4ocy81KSwxKSxjPVcofn4oby81KSwxKSxmPVtdLHA9W10sZD17fSxnPWk/MDpbXSx4PTA7aCsxPng7eCsrKXt2YXIgdj1lLmZpbmREb3RzQXRTZWdtZW50LmFwcGx5KGUsdC5jb25jYXQoeC9oKSk7Zi5wdXNoKHt4OnYueCx5OnYueSx0OngvaH0pfWZvcih4PTA7YysxPng7eCsrKXY9ZS5maW5kRG90c0F0U2VnbWVudC5hcHBseShlLHIuY29uY2F0KHgvYykpLHAucHVzaCh7eDp2LngseTp2LnksdDp4L2N9KTtmb3IoeD0wO2g+eDt4KyspZm9yKHZhciB5PTA7Yz55O3krKyl7dmFyIG09Zlt4XSxiPWZbeCsxXSxfPXBbeV0sdz1wW3krMV0saz1IKGIueC1tLngpPC4wMDE/XCJ5XCI6XCJ4XCIsQj1IKHcueC1fLngpPC4wMDE/XCJ5XCI6XCJ4XCIsQz11KG0ueCxtLnksYi54LGIueSxfLngsXy55LHcueCx3LnkpO2lmKEMpe2lmKGRbQy54LnRvRml4ZWQoNCldPT1DLnkudG9GaXhlZCg0KSljb250aW51ZTtkW0MueC50b0ZpeGVkKDQpXT1DLnkudG9GaXhlZCg0KTt2YXIgUz1tLnQrSCgoQ1trXS1tW2tdKS8oYltrXS1tW2tdKSkqKGIudC1tLnQpLFQ9Xy50K0goKENbQl0tX1tCXSkvKHdbQl0tX1tCXSkpKih3LnQtXy50KTtTPj0wJiYxLjAwMT49UyYmVD49MCYmMS4wMDE+PVQmJihpP2crKzpnLnB1c2goe3g6Qy54LHk6Qy55LHQxOkcoUywxKSx0MjpHKFQsMSl9KSl9fXJldHVybiBnfWZ1bmN0aW9uIGQodCxyLGkpe3Q9ZS5fcGF0aDJjdXJ2ZSh0KSxyPWUuX3BhdGgyY3VydmUocik7Zm9yKHZhciBuLGEscyxvLGwsaCx1LGMsZixkLGc9aT8wOltdLHg9MCx2PXQubGVuZ3RoO3Y+eDt4Kyspe3ZhciB5PXRbeF07aWYoXCJNXCI9PXlbMF0pbj1sPXlbMV0sYT1oPXlbMl07ZWxzZXtcIkNcIj09eVswXT8oZj1bbixhXS5jb25jYXQoeS5zbGljZSgxKSksbj1mWzZdLGE9Zls3XSk6KGY9W24sYSxuLGEsbCxoLGwsaF0sbj1sLGE9aCk7Zm9yKHZhciBtPTAsYj1yLmxlbmd0aDtiPm07bSsrKXt2YXIgXz1yW21dO2lmKFwiTVwiPT1fWzBdKXM9dT1fWzFdLG89Yz1fWzJdO2Vsc2V7XCJDXCI9PV9bMF0/KGQ9W3Msb10uY29uY2F0KF8uc2xpY2UoMSkpLHM9ZFs2XSxvPWRbN10pOihkPVtzLG8scyxvLHUsYyx1LGNdLHM9dSxvPWMpO3ZhciB3PXAoZixkLGkpO2lmKGkpZys9dztlbHNle2Zvcih2YXIgaz0wLEI9dy5sZW5ndGg7Qj5rO2srKyl3W2tdLnNlZ21lbnQxPXgsd1trXS5zZWdtZW50Mj1tLHdba10uYmV6MT1mLHdba10uYmV6Mj1kO2c9Zy5jb25jYXQodyl9fX19fXJldHVybiBnfWZ1bmN0aW9uIGcodCxlLHIsaSxuLGEpe251bGwhPXQ/KHRoaXMuYT0rdCx0aGlzLmI9K2UsdGhpcy5jPStyLHRoaXMuZD0raSx0aGlzLmU9K24sdGhpcy5mPSthKToodGhpcy5hPTEsdGhpcy5iPTAsdGhpcy5jPTAsdGhpcy5kPTEsdGhpcy5lPTAsdGhpcy5mPTApfWZ1bmN0aW9uIHgoKXtyZXR1cm4gdGhpcy54K0krdGhpcy55fWZ1bmN0aW9uIHYoKXtyZXR1cm4gdGhpcy54K0krdGhpcy55K0krdGhpcy53aWR0aCtcIiDDlyBcIit0aGlzLmhlaWdodH1mdW5jdGlvbiB5KHQsZSxyLGksbixhKXtmdW5jdGlvbiBzKHQpe3JldHVybigoYyp0K3UpKnQraCkqdH1mdW5jdGlvbiBvKHQsZSl7dmFyIHI9bCh0LGUpO3JldHVybigoZCpyK3ApKnIrZikqcn1mdW5jdGlvbiBsKHQsZSl7dmFyIHIsaSxuLGEsbyxsO2ZvcihuPXQsbD0wOzg+bDtsKyspe2lmKGE9cyhuKS10LEgoYSk8ZSlyZXR1cm4gbjtpZihvPSgzKmMqbisyKnUpKm4raCxIKG8pPDFlLTYpYnJlYWs7bi09YS9vfWlmKHI9MCxpPTEsbj10LHI+bilyZXR1cm4gcjtpZihuPmkpcmV0dXJuIGk7Zm9yKDtpPnI7KXtpZihhPXMobiksSChhLXQpPGUpcmV0dXJuIG47dD5hP3I9bjppPW4sbj0oaS1yKS8yK3J9cmV0dXJuIG59dmFyIGg9MyplLHU9MyooaS1lKS1oLGM9MS1oLXUsZj0zKnIscD0zKihuLXIpLWYsZD0xLWYtcDtyZXR1cm4gbyh0LDEvKDIwMCphKSl9ZnVuY3Rpb24gbSh0LGUpe3ZhciByPVtdLGk9e307aWYodGhpcy5tcz1lLHRoaXMudGltZXM9MSx0KXtmb3IodmFyIG4gaW4gdCl0W1RdKG4pJiYoaVtodChuKV09dFtuXSxyLnB1c2goaHQobikpKTtyLnNvcnQoQnQpfXRoaXMuYW5pbT1pLHRoaXMudG9wPXJbci5sZW5ndGgtMV0sdGhpcy5wZXJjZW50cz1yfWZ1bmN0aW9uIGIocixpLG4sYSxzLG8pe249aHQobik7dmFyIGwsaCx1LGM9W10sZixwLGQseD1yLm1zLHY9e30sbT17fSxiPXt9O2lmKGEpZm9yKHc9MCxCPUVlLmxlbmd0aDtCPnc7dysrKXt2YXIgXz1FZVt3XTtpZihfLmVsLmlkPT1pLmlkJiZfLmFuaW09PXIpe18ucGVyY2VudCE9bj8oRWUuc3BsaWNlKHcsMSksdT0xKTpoPV8saS5hdHRyKF8udG90YWxPcmlnaW4pO2JyZWFrfX1lbHNlIGE9K207Zm9yKHZhciB3PTAsQj1yLnBlcmNlbnRzLmxlbmd0aDtCPnc7dysrKXtpZihyLnBlcmNlbnRzW3ddPT1ufHxyLnBlcmNlbnRzW3ddPmEqci50b3Ape249ci5wZXJjZW50c1t3XSxwPXIucGVyY2VudHNbdy0xXXx8MCx4PXgvci50b3AqKG4tcCksZj1yLnBlcmNlbnRzW3crMV0sbD1yLmFuaW1bbl07YnJlYWt9YSYmaS5hdHRyKHIuYW5pbVtyLnBlcmNlbnRzW3ddXSl9aWYobCl7aWYoaCloLmluaXRzdGF0dXM9YSxoLnN0YXJ0PW5ldyBEYXRlLWgubXMqYTtlbHNle2Zvcih2YXIgQyBpbiBsKWlmKGxbVF0oQykmJihwdFtUXShDKXx8aS5wYXBlci5jdXN0b21BdHRyaWJ1dGVzW1RdKEMpKSlzd2l0Y2godltDXT1pLmF0dHIoQyksbnVsbD09dltDXSYmKHZbQ109ZnRbQ10pLG1bQ109bFtDXSxwdFtDXSl7Y2FzZSAkOmJbQ109KG1bQ10tdltDXSkveDticmVhaztjYXNlXCJjb2xvdXJcIjp2W0NdPWUuZ2V0UkdCKHZbQ10pO3ZhciBTPWUuZ2V0UkdCKG1bQ10pO2JbQ109e3I6KFMuci12W0NdLnIpL3gsZzooUy5nLXZbQ10uZykveCxiOihTLmItdltDXS5iKS94fTticmVhaztjYXNlXCJwYXRoXCI6dmFyIEE9UXQodltDXSxtW0NdKSxFPUFbMV07Zm9yKHZbQ109QVswXSxiW0NdPVtdLHc9MCxCPXZbQ10ubGVuZ3RoO0I+dzt3Kyspe2JbQ11bd109WzBdO2Zvcih2YXIgTj0xLE09dltDXVt3XS5sZW5ndGg7TT5OO04rKyliW0NdW3ddW05dPShFW3ddW05dLXZbQ11bd11bTl0pL3h9YnJlYWs7Y2FzZVwidHJhbnNmb3JtXCI6dmFyIEw9aS5fLHo9bGUoTFtDXSxtW0NdKTtpZih6KWZvcih2W0NdPXouZnJvbSxtW0NdPXoudG8sYltDXT1bXSxiW0NdLnJlYWw9ITAsdz0wLEI9dltDXS5sZW5ndGg7Qj53O3crKylmb3IoYltDXVt3XT1bdltDXVt3XVswXV0sTj0xLE09dltDXVt3XS5sZW5ndGg7TT5OO04rKyliW0NdW3ddW05dPShtW0NdW3ddW05dLXZbQ11bd11bTl0pL3g7ZWxzZXt2YXIgRj1pLm1hdHJpeHx8bmV3IGcsUj17Xzp7dHJhbnNmb3JtOkwudHJhbnNmb3JtfSxnZXRCQm94OmZ1bmN0aW9uKCl7cmV0dXJuIGkuZ2V0QkJveCgxKX19O3ZbQ109W0YuYSxGLmIsRi5jLEYuZCxGLmUsRi5mXSxzZShSLG1bQ10pLG1bQ109Ui5fLnRyYW5zZm9ybSxiW0NdPVsoUi5tYXRyaXguYS1GLmEpL3gsKFIubWF0cml4LmItRi5iKS94LChSLm1hdHJpeC5jLUYuYykveCwoUi5tYXRyaXguZC1GLmQpL3gsKFIubWF0cml4LmUtRi5lKS94LChSLm1hdHJpeC5mLUYuZikveF19YnJlYWs7Y2FzZVwiY3N2XCI6dmFyIEk9aihsW0NdKVtxXShrKSxEPWoodltDXSlbcV0oayk7aWYoXCJjbGlwLXJlY3RcIj09Qylmb3IodltDXT1ELGJbQ109W10sdz1ELmxlbmd0aDt3LS07KWJbQ11bd109KElbd10tdltDXVt3XSkveDttW0NdPUk7YnJlYWs7ZGVmYXVsdDpmb3IoST1bXVtQXShsW0NdKSxEPVtdW1BdKHZbQ10pLGJbQ109W10sdz1pLnBhcGVyLmN1c3RvbUF0dHJpYnV0ZXNbQ10ubGVuZ3RoO3ctLTspYltDXVt3XT0oKElbd118fDApLShEW3ddfHwwKSkveH12YXIgVj1sLmVhc2luZyxPPWUuZWFzaW5nX2Zvcm11bGFzW1ZdO2lmKCFPKWlmKE89aihWKS5tYXRjaChzdCksTyYmNT09Ty5sZW5ndGgpe3ZhciBZPU87Tz1mdW5jdGlvbih0KXtyZXR1cm4geSh0LCtZWzFdLCtZWzJdLCtZWzNdLCtZWzRdLHgpfX1lbHNlIE89U3Q7aWYoZD1sLnN0YXJ0fHxyLnN0YXJ0fHwrbmV3IERhdGUsXz17YW5pbTpyLHBlcmNlbnQ6bix0aW1lc3RhbXA6ZCxzdGFydDpkKyhyLmRlbHx8MCksc3RhdHVzOjAsaW5pdHN0YXR1czphfHwwLHN0b3A6ITEsbXM6eCxlYXNpbmc6Tyxmcm9tOnYsZGlmZjpiLHRvOm0sZWw6aSxjYWxsYmFjazpsLmNhbGxiYWNrLHByZXY6cCxuZXh0OmYscmVwZWF0Om98fHIudGltZXMsb3JpZ2luOmkuYXR0cigpLHRvdGFsT3JpZ2luOnN9LEVlLnB1c2goXyksYSYmIWgmJiF1JiYoXy5zdG9wPSEwLF8uc3RhcnQ9bmV3IERhdGUteCphLDE9PUVlLmxlbmd0aCkpcmV0dXJuIE1lKCk7dSYmKF8uc3RhcnQ9bmV3IERhdGUtXy5tcyphKSwxPT1FZS5sZW5ndGgmJk5lKE1lKX10KFwicmFwaGFlbC5hbmltLnN0YXJ0LlwiK2kuaWQsaSxyKX19ZnVuY3Rpb24gXyh0KXtmb3IodmFyIGU9MDtlPEVlLmxlbmd0aDtlKyspRWVbZV0uZWwucGFwZXI9PXQmJkVlLnNwbGljZShlLS0sMSl9ZS52ZXJzaW9uPVwiMi4yLjBcIixlLmV2ZT10O3ZhciB3LGs9L1ssIF0rLyxCPXtjaXJjbGU6MSxyZWN0OjEscGF0aDoxLGVsbGlwc2U6MSx0ZXh0OjEsaW1hZ2U6MX0sQz0vXFx7KFxcZCspXFx9L2csUz1cInByb3RvdHlwZVwiLFQ9XCJoYXNPd25Qcm9wZXJ0eVwiLEE9e2RvYzpkb2N1bWVudCx3aW46d2luZG93fSxFPXt3YXM6T2JqZWN0LnByb3RvdHlwZVtUXS5jYWxsKEEud2luLFwiUmFwaGFlbFwiKSxpczpBLndpbi5SYXBoYWVsfSxOPWZ1bmN0aW9uKCl7dGhpcy5jYT10aGlzLmN1c3RvbUF0dHJpYnV0ZXM9e319LE0sTD1cImFwcGVuZENoaWxkXCIsej1cImFwcGx5XCIsUD1cImNvbmNhdFwiLEY9XCJvbnRvdWNoc3RhcnRcImluIEEud2lufHxBLndpbi5Eb2N1bWVudFRvdWNoJiZBLmRvYyBpbnN0YW5jZW9mIERvY3VtZW50VG91Y2gsUj1cIlwiLEk9XCIgXCIsaj1TdHJpbmcscT1cInNwbGl0XCIsRD1cImNsaWNrIGRibGNsaWNrIG1vdXNlZG93biBtb3VzZW1vdmUgbW91c2VvdXQgbW91c2VvdmVyIG1vdXNldXAgdG91Y2hzdGFydCB0b3VjaG1vdmUgdG91Y2hlbmQgdG91Y2hjYW5jZWxcIltxXShJKSxWPXttb3VzZWRvd246XCJ0b3VjaHN0YXJ0XCIsbW91c2Vtb3ZlOlwidG91Y2htb3ZlXCIsbW91c2V1cDpcInRvdWNoZW5kXCJ9LE89ai5wcm90b3R5cGUudG9Mb3dlckNhc2UsWT1NYXRoLFc9WS5tYXgsRz1ZLm1pbixIPVkuYWJzLFg9WS5wb3csVT1ZLlBJLCQ9XCJudW1iZXJcIixaPVwic3RyaW5nXCIsUT1cImFycmF5XCIsSj1cInRvU3RyaW5nXCIsSz1cImZpbGxcIix0dD1PYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLGV0PXt9LHJ0PVwicHVzaFwiLGl0PWUuX0lTVVJMPS9edXJsXFwoWydcIl0/KC4rPylbJ1wiXT9cXCkkL2ksbnQ9L15cXHMqKCgjW2EtZlxcZF17Nn0pfCgjW2EtZlxcZF17M30pfHJnYmE/XFwoXFxzKihbXFxkXFwuXSslP1xccyosXFxzKltcXGRcXC5dKyU/XFxzKixcXHMqW1xcZFxcLl0rJT8oPzpcXHMqLFxccypbXFxkXFwuXSslPyk/KVxccypcXCl8aHNiYT9cXChcXHMqKFtcXGRcXC5dKyg/OmRlZ3xcXHhiMHwlKT9cXHMqLFxccypbXFxkXFwuXSslP1xccyosXFxzKltcXGRcXC5dKyg/OiU/XFxzKixcXHMqW1xcZFxcLl0rKT8pJT9cXHMqXFwpfGhzbGE/XFwoXFxzKihbXFxkXFwuXSsoPzpkZWd8XFx4YjB8JSk/XFxzKixcXHMqW1xcZFxcLl0rJT9cXHMqLFxccypbXFxkXFwuXSsoPzolP1xccyosXFxzKltcXGRcXC5dKyk/KSU/XFxzKlxcKSlcXHMqJC9pLGF0PXtOYU46MSxJbmZpbml0eToxLFwiLUluZmluaXR5XCI6MX0sc3Q9L14oPzpjdWJpYy0pP2JlemllclxcKChbXixdKyksKFteLF0rKSwoW14sXSspLChbXlxcKV0rKVxcKS8sb3Q9WS5yb3VuZCxsdD1cInNldEF0dHJpYnV0ZVwiLGh0PXBhcnNlRmxvYXQsdXQ9cGFyc2VJbnQsY3Q9ai5wcm90b3R5cGUudG9VcHBlckNhc2UsZnQ9ZS5fYXZhaWxhYmxlQXR0cnM9e1wiYXJyb3ctZW5kXCI6XCJub25lXCIsXCJhcnJvdy1zdGFydFwiOlwibm9uZVwiLGJsdXI6MCxcImNsaXAtcmVjdFwiOlwiMCAwIDFlOSAxZTlcIixjdXJzb3I6XCJkZWZhdWx0XCIsY3g6MCxjeTowLGZpbGw6XCIjZmZmXCIsXCJmaWxsLW9wYWNpdHlcIjoxLGZvbnQ6JzEwcHggXCJBcmlhbFwiJyxcImZvbnQtZmFtaWx5XCI6J1wiQXJpYWxcIicsXCJmb250LXNpemVcIjpcIjEwXCIsXCJmb250LXN0eWxlXCI6XCJub3JtYWxcIixcImZvbnQtd2VpZ2h0XCI6NDAwLGdyYWRpZW50OjAsaGVpZ2h0OjAsaHJlZjpcImh0dHA6Ly9yYXBoYWVsanMuY29tL1wiLFwibGV0dGVyLXNwYWNpbmdcIjowLG9wYWNpdHk6MSxwYXRoOlwiTTAsMFwiLHI6MCxyeDowLHJ5OjAsc3JjOlwiXCIsc3Ryb2tlOlwiIzAwMFwiLFwic3Ryb2tlLWRhc2hhcnJheVwiOlwiXCIsXCJzdHJva2UtbGluZWNhcFwiOlwiYnV0dFwiLFwic3Ryb2tlLWxpbmVqb2luXCI6XCJidXR0XCIsXCJzdHJva2UtbWl0ZXJsaW1pdFwiOjAsXCJzdHJva2Utb3BhY2l0eVwiOjEsXCJzdHJva2Utd2lkdGhcIjoxLHRhcmdldDpcIl9ibGFua1wiLFwidGV4dC1hbmNob3JcIjpcIm1pZGRsZVwiLHRpdGxlOlwiUmFwaGFlbFwiLHRyYW5zZm9ybTpcIlwiLHdpZHRoOjAseDowLHk6MCxcImNsYXNzXCI6XCJcIn0scHQ9ZS5fYXZhaWxhYmxlQW5pbUF0dHJzPXtibHVyOiQsXCJjbGlwLXJlY3RcIjpcImNzdlwiLGN4OiQsY3k6JCxmaWxsOlwiY29sb3VyXCIsXCJmaWxsLW9wYWNpdHlcIjokLFwiZm9udC1zaXplXCI6JCxoZWlnaHQ6JCxvcGFjaXR5OiQscGF0aDpcInBhdGhcIixyOiQscng6JCxyeTokLHN0cm9rZTpcImNvbG91clwiLFwic3Ryb2tlLW9wYWNpdHlcIjokLFwic3Ryb2tlLXdpZHRoXCI6JCx0cmFuc2Zvcm06XCJ0cmFuc2Zvcm1cIix3aWR0aDokLHg6JCx5OiR9LGR0PS9bXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjldL2csZ3Q9L1tcXHgwOVxceDBhXFx4MGJcXHgwY1xceDBkXFx4MjBcXHhhMFxcdTE2ODBcXHUxODBlXFx1MjAwMFxcdTIwMDFcXHUyMDAyXFx1MjAwM1xcdTIwMDRcXHUyMDA1XFx1MjAwNlxcdTIwMDdcXHUyMDA4XFx1MjAwOVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHUyMDI4XFx1MjAyOV0qLFtcXHgwOVxceDBhXFx4MGJcXHgwY1xceDBkXFx4MjBcXHhhMFxcdTE2ODBcXHUxODBlXFx1MjAwMFxcdTIwMDFcXHUyMDAyXFx1MjAwM1xcdTIwMDRcXHUyMDA1XFx1MjAwNlxcdTIwMDdcXHUyMDA4XFx1MjAwOVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHUyMDI4XFx1MjAyOV0qLyx4dD17aHM6MSxyZzoxfSx2dD0vLD8oW2FjaGxtcXJzdHZ4el0pLD8vZ2kseXQ9LyhbYWNobG1ycXN0dnpdKVtcXHgwOVxceDBhXFx4MGJcXHgwY1xceDBkXFx4MjBcXHhhMFxcdTE2ODBcXHUxODBlXFx1MjAwMFxcdTIwMDFcXHUyMDAyXFx1MjAwM1xcdTIwMDRcXHUyMDA1XFx1MjAwNlxcdTIwMDdcXHUyMDA4XFx1MjAwOVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHUyMDI4XFx1MjAyOSxdKigoLT9cXGQqXFwuP1xcZCooPzplW1xcLStdP1xcZCspP1tcXHgwOVxceDBhXFx4MGJcXHgwY1xceDBkXFx4MjBcXHhhMFxcdTE2ODBcXHUxODBlXFx1MjAwMFxcdTIwMDFcXHUyMDAyXFx1MjAwM1xcdTIwMDRcXHUyMDA1XFx1MjAwNlxcdTIwMDdcXHUyMDA4XFx1MjAwOVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHUyMDI4XFx1MjAyOV0qLD9bXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjldKikrKS9naSxtdD0vKFtyc3RtXSlbXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjksXSooKC0/XFxkKlxcLj9cXGQqKD86ZVtcXC0rXT9cXGQrKT9bXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjldKiw/W1xceDA5XFx4MGFcXHgwYlxceDBjXFx4MGRcXHgyMFxceGEwXFx1MTY4MFxcdTE4MGVcXHUyMDAwXFx1MjAwMVxcdTIwMDJcXHUyMDAzXFx1MjAwNFxcdTIwMDVcXHUyMDA2XFx1MjAwN1xcdTIwMDhcXHUyMDA5XFx1MjAwYVxcdTIwMmZcXHUyMDVmXFx1MzAwMFxcdTIwMjhcXHUyMDI5XSopKykvZ2ksYnQ9LygtP1xcZCpcXC4/XFxkKig/OmVbXFwtK10/XFxkKyk/KVtcXHgwOVxceDBhXFx4MGJcXHgwY1xceDBkXFx4MjBcXHhhMFxcdTE2ODBcXHUxODBlXFx1MjAwMFxcdTIwMDFcXHUyMDAyXFx1MjAwM1xcdTIwMDRcXHUyMDA1XFx1MjAwNlxcdTIwMDdcXHUyMDA4XFx1MjAwOVxcdTIwMGFcXHUyMDJmXFx1MjA1ZlxcdTMwMDBcXHUyMDI4XFx1MjAyOV0qLD9bXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjldKi9naSxfdD1lLl9yYWRpYWxfZ3JhZGllbnQ9L15yKD86XFwoKFteLF0rPylbXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjldKixbXFx4MDlcXHgwYVxceDBiXFx4MGNcXHgwZFxceDIwXFx4YTBcXHUxNjgwXFx1MTgwZVxcdTIwMDBcXHUyMDAxXFx1MjAwMlxcdTIwMDNcXHUyMDA0XFx1MjAwNVxcdTIwMDZcXHUyMDA3XFx1MjAwOFxcdTIwMDlcXHUyMDBhXFx1MjAyZlxcdTIwNWZcXHUzMDAwXFx1MjAyOFxcdTIwMjldKihbXlxcKV0rPylcXCkpPy8sd3Q9e30sa3Q9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdC5rZXktZS5rZXl9LEJ0PWZ1bmN0aW9uKHQsZSl7cmV0dXJuIGh0KHQpLWh0KGUpfSxDdD1mdW5jdGlvbigpe30sU3Q9ZnVuY3Rpb24odCl7cmV0dXJuIHR9LFR0PWUuX3JlY3RQYXRoPWZ1bmN0aW9uKHQsZSxyLGksbil7cmV0dXJuIG4/W1tcIk1cIix0K24sZV0sW1wibFwiLHItMipuLDBdLFtcImFcIixuLG4sMCwwLDEsbixuXSxbXCJsXCIsMCxpLTIqbl0sW1wiYVwiLG4sbiwwLDAsMSwtbixuXSxbXCJsXCIsMipuLXIsMF0sW1wiYVwiLG4sbiwwLDAsMSwtbiwtbl0sW1wibFwiLDAsMipuLWldLFtcImFcIixuLG4sMCwwLDEsbiwtbl0sW1wielwiXV06W1tcIk1cIix0LGVdLFtcImxcIixyLDBdLFtcImxcIiwwLGldLFtcImxcIiwtciwwXSxbXCJ6XCJdXX0sQXQ9ZnVuY3Rpb24odCxlLHIsaSl7cmV0dXJuIG51bGw9PWkmJihpPXIpLFtbXCJNXCIsdCxlXSxbXCJtXCIsMCwtaV0sW1wiYVwiLHIsaSwwLDEsMSwwLDIqaV0sW1wiYVwiLHIsaSwwLDEsMSwwLC0yKmldLFtcInpcIl1dfSxFdD1lLl9nZXRQYXRoPXtwYXRoOmZ1bmN0aW9uKHQpe3JldHVybiB0LmF0dHIoXCJwYXRoXCIpfSxjaXJjbGU6ZnVuY3Rpb24odCl7dmFyIGU9dC5hdHRycztyZXR1cm4gQXQoZS5jeCxlLmN5LGUucil9LGVsbGlwc2U6ZnVuY3Rpb24odCl7dmFyIGU9dC5hdHRycztyZXR1cm4gQXQoZS5jeCxlLmN5LGUucngsZS5yeSl9LHJlY3Q6ZnVuY3Rpb24odCl7dmFyIGU9dC5hdHRycztyZXR1cm4gVHQoZS54LGUueSxlLndpZHRoLGUuaGVpZ2h0LGUucil9LGltYWdlOmZ1bmN0aW9uKHQpe3ZhciBlPXQuYXR0cnM7cmV0dXJuIFR0KGUueCxlLnksZS53aWR0aCxlLmhlaWdodCl9LHRleHQ6ZnVuY3Rpb24odCl7dmFyIGU9dC5fZ2V0QkJveCgpO3JldHVybiBUdChlLngsZS55LGUud2lkdGgsZS5oZWlnaHQpfSxzZXQ6ZnVuY3Rpb24odCl7dmFyIGU9dC5fZ2V0QkJveCgpO3JldHVybiBUdChlLngsZS55LGUud2lkdGgsZS5oZWlnaHQpfX0sTnQ9ZS5tYXBQYXRoPWZ1bmN0aW9uKHQsZSl7aWYoIWUpcmV0dXJuIHQ7dmFyIHIsaSxuLGEscyxvLGw7Zm9yKHQ9UXQodCksbj0wLHM9dC5sZW5ndGg7cz5uO24rKylmb3IobD10W25dLGE9MSxvPWwubGVuZ3RoO28+YTthKz0yKXI9ZS54KGxbYV0sbFthKzFdKSxpPWUueShsW2FdLGxbYSsxXSksbFthXT1yLGxbYSsxXT1pO3JldHVybiB0fTtpZihlLl9nPUEsZS50eXBlPUEud2luLlNWR0FuZ2xlfHxBLmRvYy5pbXBsZW1lbnRhdGlvbi5oYXNGZWF0dXJlKFwiaHR0cDovL3d3dy53My5vcmcvVFIvU1ZHMTEvZmVhdHVyZSNCYXNpY1N0cnVjdHVyZVwiLFwiMS4xXCIpP1wiU1ZHXCI6XCJWTUxcIixcIlZNTFwiPT1lLnR5cGUpe3ZhciBNdD1BLmRvYy5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLEx0O2lmKE10LmlubmVySFRNTD0nPHY6c2hhcGUgYWRqPVwiMVwiLz4nLEx0PU10LmZpcnN0Q2hpbGQsTHQuc3R5bGUuYmVoYXZpb3I9XCJ1cmwoI2RlZmF1bHQjVk1MKVwiLCFMdHx8XCJvYmplY3RcIiE9dHlwZW9mIEx0LmFkailyZXR1cm4gZS50eXBlPVI7TXQ9bnVsbH1lLnN2Zz0hKGUudm1sPVwiVk1MXCI9PWUudHlwZSksZS5fUGFwZXI9TixlLmZuPU09Ti5wcm90b3R5cGU9ZS5wcm90b3R5cGUsZS5faWQ9MCxlLl9vaWQ9MCxlLmlzPWZ1bmN0aW9uKHQsZSl7cmV0dXJuIGU9Ty5jYWxsKGUpLFwiZmluaXRlXCI9PWU/IWF0W1RdKCt0KTpcImFycmF5XCI9PWU/dCBpbnN0YW5jZW9mIEFycmF5OlwibnVsbFwiPT1lJiZudWxsPT09dHx8ZT09dHlwZW9mIHQmJm51bGwhPT10fHxcIm9iamVjdFwiPT1lJiZ0PT09T2JqZWN0KHQpfHxcImFycmF5XCI9PWUmJkFycmF5LmlzQXJyYXkmJkFycmF5LmlzQXJyYXkodCl8fHR0LmNhbGwodCkuc2xpY2UoOCwtMSkudG9Mb3dlckNhc2UoKT09ZX0sZS5hbmdsZT1mdW5jdGlvbih0LHIsaSxuLGEscyl7aWYobnVsbD09YSl7dmFyIG89dC1pLGw9ci1uO3JldHVybiBvfHxsPygxODArMTgwKlkuYXRhbjIoLWwsLW8pL1UrMzYwKSUzNjA6MH1yZXR1cm4gZS5hbmdsZSh0LHIsYSxzKS1lLmFuZ2xlKGksbixhLHMpfSxlLnJhZD1mdW5jdGlvbih0KXtyZXR1cm4gdCUzNjAqVS8xODB9LGUuZGVnPWZ1bmN0aW9uKHQpe3JldHVybiBNYXRoLnJvdW5kKDE4MCp0L1UlMzYwKjFlMykvMWUzfSxlLnNuYXBUbz1mdW5jdGlvbih0LHIsaSl7aWYoaT1lLmlzKGksXCJmaW5pdGVcIik/aToxMCxlLmlzKHQsUSkpe2Zvcih2YXIgbj10Lmxlbmd0aDtuLS07KWlmKEgodFtuXS1yKTw9aSlyZXR1cm4gdFtuXX1lbHNle3Q9K3Q7dmFyIGE9ciV0O2lmKGk+YSlyZXR1cm4gci1hO2lmKGE+dC1pKXJldHVybiByLWErdH1yZXR1cm4gcn07dmFyIHp0PWUuY3JlYXRlVVVJRD1mdW5jdGlvbih0LGUpe3JldHVybiBmdW5jdGlvbigpe3JldHVyblwieHh4eHh4eHgteHh4eC00eHh4LXl4eHgteHh4eHh4eHh4eHh4XCIucmVwbGFjZSh0LGUpLnRvVXBwZXJDYXNlKCl9fSgvW3h5XS9nLGZ1bmN0aW9uKHQpe3ZhciBlPTE2KlkucmFuZG9tKCl8MCxyPVwieFwiPT10P2U6MyZlfDg7cmV0dXJuIHIudG9TdHJpbmcoMTYpfSk7ZS5zZXRXaW5kb3c9ZnVuY3Rpb24ocil7dChcInJhcGhhZWwuc2V0V2luZG93XCIsZSxBLndpbixyKSxBLndpbj1yLEEuZG9jPUEud2luLmRvY3VtZW50LGUuX2VuZ2luZS5pbml0V2luJiZlLl9lbmdpbmUuaW5pdFdpbihBLndpbil9O3ZhciBQdD1mdW5jdGlvbih0KXtpZihlLnZtbCl7dmFyIHI9L15cXHMrfFxccyskL2csaTt0cnl7dmFyIGE9bmV3IEFjdGl2ZVhPYmplY3QoXCJodG1sZmlsZVwiKTthLndyaXRlKFwiPGJvZHk+XCIpLGEuY2xvc2UoKSxpPWEuYm9keX1jYXRjaChzKXtpPWNyZWF0ZVBvcHVwKCkuZG9jdW1lbnQuYm9keX12YXIgbz1pLmNyZWF0ZVRleHRSYW5nZSgpO1B0PW4oZnVuY3Rpb24odCl7dHJ5e2kuc3R5bGUuY29sb3I9aih0KS5yZXBsYWNlKHIsUik7dmFyIGU9by5xdWVyeUNvbW1hbmRWYWx1ZShcIkZvcmVDb2xvclwiKTtyZXR1cm4gZT0oMjU1JmUpPDwxNnw2NTI4MCZlfCgxNjcxMTY4MCZlKT4+PjE2LFwiI1wiKyhcIjAwMDAwMFwiK2UudG9TdHJpbmcoMTYpKS5zbGljZSgtNil9Y2F0Y2gobil7cmV0dXJuXCJub25lXCJ9fSl9ZWxzZXt2YXIgbD1BLmRvYy5jcmVhdGVFbGVtZW50KFwiaVwiKTtsLnRpdGxlPVwiUmFwaGHDq2wgQ29sb3VyIFBpY2tlclwiLGwuc3R5bGUuZGlzcGxheT1cIm5vbmVcIixBLmRvYy5ib2R5LmFwcGVuZENoaWxkKGwpLFB0PW4oZnVuY3Rpb24odCl7cmV0dXJuIGwuc3R5bGUuY29sb3I9dCxBLmRvYy5kZWZhdWx0Vmlldy5nZXRDb21wdXRlZFN0eWxlKGwsUikuZ2V0UHJvcGVydHlWYWx1ZShcImNvbG9yXCIpfSl9cmV0dXJuIFB0KHQpfSxGdD1mdW5jdGlvbigpe3JldHVyblwiaHNiKFwiK1t0aGlzLmgsdGhpcy5zLHRoaXMuYl0rXCIpXCJ9LFJ0PWZ1bmN0aW9uKCl7cmV0dXJuXCJoc2woXCIrW3RoaXMuaCx0aGlzLnMsdGhpcy5sXStcIilcIn0sSXQ9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5oZXh9LGp0PWZ1bmN0aW9uKHQscixpKXtpZihudWxsPT1yJiZlLmlzKHQsXCJvYmplY3RcIikmJlwiclwiaW4gdCYmXCJnXCJpbiB0JiZcImJcImluIHQmJihpPXQuYixyPXQuZyx0PXQuciksbnVsbD09ciYmZS5pcyh0LFopKXt2YXIgbj1lLmdldFJHQih0KTt0PW4ucixyPW4uZyxpPW4uYn1yZXR1cm4odD4xfHxyPjF8fGk+MSkmJih0Lz0yNTUsci89MjU1LGkvPTI1NSksW3QscixpXX0scXQ9ZnVuY3Rpb24odCxyLGksbil7dCo9MjU1LHIqPTI1NSxpKj0yNTU7dmFyIGE9e3I6dCxnOnIsYjppLGhleDplLnJnYih0LHIsaSksdG9TdHJpbmc6SXR9O3JldHVybiBlLmlzKG4sXCJmaW5pdGVcIikmJihhLm9wYWNpdHk9biksYX07ZS5jb2xvcj1mdW5jdGlvbih0KXt2YXIgcjtyZXR1cm4gZS5pcyh0LFwib2JqZWN0XCIpJiZcImhcImluIHQmJlwic1wiaW4gdCYmXCJiXCJpbiB0PyhyPWUuaHNiMnJnYih0KSx0LnI9ci5yLHQuZz1yLmcsdC5iPXIuYix0LmhleD1yLmhleCk6ZS5pcyh0LFwib2JqZWN0XCIpJiZcImhcImluIHQmJlwic1wiaW4gdCYmXCJsXCJpbiB0PyhyPWUuaHNsMnJnYih0KSx0LnI9ci5yLHQuZz1yLmcsdC5iPXIuYix0LmhleD1yLmhleCk6KGUuaXModCxcInN0cmluZ1wiKSYmKHQ9ZS5nZXRSR0IodCkpLGUuaXModCxcIm9iamVjdFwiKSYmXCJyXCJpbiB0JiZcImdcImluIHQmJlwiYlwiaW4gdD8ocj1lLnJnYjJoc2wodCksdC5oPXIuaCx0LnM9ci5zLHQubD1yLmwscj1lLnJnYjJoc2IodCksdC52PXIuYik6KHQ9e2hleDpcIm5vbmVcIn0sdC5yPXQuZz10LmI9dC5oPXQucz10LnY9dC5sPS0xKSksdC50b1N0cmluZz1JdCx0fSxlLmhzYjJyZ2I9ZnVuY3Rpb24odCxlLHIsaSl7dGhpcy5pcyh0LFwib2JqZWN0XCIpJiZcImhcImluIHQmJlwic1wiaW4gdCYmXCJiXCJpbiB0JiYocj10LmIsZT10LnMsaT10Lm8sdD10LmgpLHQqPTM2MDt2YXIgbixhLHMsbyxsO3JldHVybiB0PXQlMzYwLzYwLGw9ciplLG89bCooMS1IKHQlMi0xKSksbj1hPXM9ci1sLHQ9fn50LG4rPVtsLG8sMCwwLG8sbF1bdF0sYSs9W28sbCxsLG8sMCwwXVt0XSxzKz1bMCwwLG8sbCxsLG9dW3RdLHF0KG4sYSxzLGkpfSxlLmhzbDJyZ2I9ZnVuY3Rpb24odCxlLHIsaSl7dGhpcy5pcyh0LFwib2JqZWN0XCIpJiZcImhcImluIHQmJlwic1wiaW4gdCYmXCJsXCJpbiB0JiYocj10LmwsZT10LnMsdD10LmgpLCh0PjF8fGU+MXx8cj4xKSYmKHQvPTM2MCxlLz0xMDAsci89MTAwKSx0Kj0zNjA7dmFyIG4sYSxzLG8sbDtyZXR1cm4gdD10JTM2MC82MCxsPTIqZSooLjU+cj9yOjEtciksbz1sKigxLUgodCUyLTEpKSxuPWE9cz1yLWwvMix0PX5+dCxuKz1bbCxvLDAsMCxvLGxdW3RdLGErPVtvLGwsbCxvLDAsMF1bdF0scys9WzAsMCxvLGwsbCxvXVt0XSxxdChuLGEscyxpKX0sZS5yZ2IyaHNiPWZ1bmN0aW9uKHQsZSxyKXtyPWp0KHQsZSxyKSx0PXJbMF0sZT1yWzFdLHI9clsyXTt2YXIgaSxuLGEscztyZXR1cm4gYT1XKHQsZSxyKSxzPWEtRyh0LGUsciksaT0wPT1zP251bGw6YT09dD8oZS1yKS9zOmE9PWU/KHItdCkvcysyOih0LWUpL3MrNCxpPShpKzM2MCklNio2MC8zNjAsbj0wPT1zPzA6cy9hLHtoOmksczpuLGI6YSx0b1N0cmluZzpGdH19LGUucmdiMmhzbD1mdW5jdGlvbih0LGUscil7cj1qdCh0LGUsciksdD1yWzBdLGU9clsxXSxyPXJbMl07dmFyIGksbixhLHMsbyxsO3JldHVybiBzPVcodCxlLHIpLG89Ryh0LGUsciksbD1zLW8saT0wPT1sP251bGw6cz09dD8oZS1yKS9sOnM9PWU/KHItdCkvbCsyOih0LWUpL2wrNCxpPShpKzM2MCklNio2MC8zNjAsYT0ocytvKS8yLG49MD09bD8wOi41PmE/bC8oMiphKTpsLygyLTIqYSkse2g6aSxzOm4sbDphLHRvU3RyaW5nOlJ0fX0sZS5fcGF0aDJzdHJpbmc9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5qb2luKFwiLFwiKS5yZXBsYWNlKHZ0LFwiJDFcIil9O3ZhciBEdD1lLl9wcmVsb2FkPWZ1bmN0aW9uKHQsZSl7dmFyIHI9QS5kb2MuY3JlYXRlRWxlbWVudChcImltZ1wiKTtyLnN0eWxlLmNzc1RleHQ9XCJwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0Oi05OTk5ZW07dG9wOi05OTk5ZW1cIixyLm9ubG9hZD1mdW5jdGlvbigpe2UuY2FsbCh0aGlzKSx0aGlzLm9ubG9hZD1udWxsLEEuZG9jLmJvZHkucmVtb3ZlQ2hpbGQodGhpcyl9LHIub25lcnJvcj1mdW5jdGlvbigpe0EuZG9jLmJvZHkucmVtb3ZlQ2hpbGQodGhpcyl9LEEuZG9jLmJvZHkuYXBwZW5kQ2hpbGQociksci5zcmM9dH07ZS5nZXRSR0I9bihmdW5jdGlvbih0KXtpZighdHx8KHQ9aih0KSkuaW5kZXhPZihcIi1cIikrMSlyZXR1cm57cjotMSxnOi0xLGI6LTEsaGV4Olwibm9uZVwiLGVycm9yOjEsdG9TdHJpbmc6YX07aWYoXCJub25lXCI9PXQpcmV0dXJue3I6LTEsZzotMSxiOi0xLGhleDpcIm5vbmVcIix0b1N0cmluZzphfTshKHh0W1RdKHQudG9Mb3dlckNhc2UoKS5zdWJzdHJpbmcoMCwyKSl8fFwiI1wiPT10LmNoYXJBdCgpKSYmKHQ9UHQodCkpO3ZhciByLGksbixzLG8sbCxoLHU9dC5tYXRjaChudCk7cmV0dXJuIHU/KHVbMl0mJihzPXV0KHVbMl0uc3Vic3RyaW5nKDUpLDE2KSxuPXV0KHVbMl0uc3Vic3RyaW5nKDMsNSksMTYpLGk9dXQodVsyXS5zdWJzdHJpbmcoMSwzKSwxNikpLHVbM10mJihzPXV0KChsPXVbM10uY2hhckF0KDMpKStsLDE2KSxuPXV0KChsPXVbM10uY2hhckF0KDIpKStsLDE2KSxpPXV0KChsPXVbM10uY2hhckF0KDEpKStsLDE2KSksdVs0XSYmKGg9dVs0XVtxXShndCksaT1odChoWzBdKSxcIiVcIj09aFswXS5zbGljZSgtMSkmJihpKj0yLjU1KSxuPWh0KGhbMV0pLFwiJVwiPT1oWzFdLnNsaWNlKC0xKSYmKG4qPTIuNTUpLHM9aHQoaFsyXSksXCIlXCI9PWhbMl0uc2xpY2UoLTEpJiYocyo9Mi41NSksXCJyZ2JhXCI9PXVbMV0udG9Mb3dlckNhc2UoKS5zbGljZSgwLDQpJiYobz1odChoWzNdKSksaFszXSYmXCIlXCI9PWhbM10uc2xpY2UoLTEpJiYoby89MTAwKSksdVs1XT8oaD11WzVdW3FdKGd0KSxpPWh0KGhbMF0pLFwiJVwiPT1oWzBdLnNsaWNlKC0xKSYmKGkqPTIuNTUpLG49aHQoaFsxXSksXCIlXCI9PWhbMV0uc2xpY2UoLTEpJiYobio9Mi41NSkscz1odChoWzJdKSxcIiVcIj09aFsyXS5zbGljZSgtMSkmJihzKj0yLjU1KSwoXCJkZWdcIj09aFswXS5zbGljZSgtMyl8fFwiwrBcIj09aFswXS5zbGljZSgtMSkpJiYoaS89MzYwKSxcImhzYmFcIj09dVsxXS50b0xvd2VyQ2FzZSgpLnNsaWNlKDAsNCkmJihvPWh0KGhbM10pKSxoWzNdJiZcIiVcIj09aFszXS5zbGljZSgtMSkmJihvLz0xMDApLGUuaHNiMnJnYihpLG4scyxvKSk6dVs2XT8oaD11WzZdW3FdKGd0KSxpPWh0KGhbMF0pLFwiJVwiPT1oWzBdLnNsaWNlKC0xKSYmKGkqPTIuNTUpLG49aHQoaFsxXSksXCIlXCI9PWhbMV0uc2xpY2UoLTEpJiYobio9Mi41NSkscz1odChoWzJdKSxcIiVcIj09aFsyXS5zbGljZSgtMSkmJihzKj0yLjU1KSwoXCJkZWdcIj09aFswXS5zbGljZSgtMyl8fFwiwrBcIj09aFswXS5zbGljZSgtMSkpJiYoaS89MzYwKSxcImhzbGFcIj09dVsxXS50b0xvd2VyQ2FzZSgpLnNsaWNlKDAsNCkmJihvPWh0KGhbM10pKSxoWzNdJiZcIiVcIj09aFszXS5zbGljZSgtMSkmJihvLz0xMDApLGUuaHNsMnJnYihpLG4scyxvKSk6KHU9e3I6aSxnOm4sYjpzLHRvU3RyaW5nOmF9LHUuaGV4PVwiI1wiKygxNjc3NzIxNnxzfG48PDh8aTw8MTYpLnRvU3RyaW5nKDE2KS5zbGljZSgxKSxlLmlzKG8sXCJmaW5pdGVcIikmJih1Lm9wYWNpdHk9byksdSkpOntyOi0xLGc6LTEsYjotMSxoZXg6XCJub25lXCIsZXJyb3I6MSx0b1N0cmluZzphfX0sZSksZS5oc2I9bihmdW5jdGlvbih0LHIsaSl7cmV0dXJuIGUuaHNiMnJnYih0LHIsaSkuaGV4fSksZS5oc2w9bihmdW5jdGlvbih0LHIsaSl7cmV0dXJuIGUuaHNsMnJnYih0LHIsaSkuaGV4fSksZS5yZ2I9bihmdW5jdGlvbih0LGUscil7ZnVuY3Rpb24gaSh0KXtyZXR1cm4gdCsuNXwwfXJldHVyblwiI1wiKygxNjc3NzIxNnxpKHIpfGkoZSk8PDh8aSh0KTw8MTYpLnRvU3RyaW5nKDE2KS5zbGljZSgxKX0pLGUuZ2V0Q29sb3I9ZnVuY3Rpb24odCl7dmFyIGU9dGhpcy5nZXRDb2xvci5zdGFydD10aGlzLmdldENvbG9yLnN0YXJ0fHx7aDowLHM6MSxiOnR8fC43NX0scj10aGlzLmhzYjJyZ2IoZS5oLGUucyxlLmIpO3JldHVybiBlLmgrPS4wNzUsZS5oPjEmJihlLmg9MCxlLnMtPS4yLGUuczw9MCYmKHRoaXMuZ2V0Q29sb3Iuc3RhcnQ9e2g6MCxzOjEsYjplLmJ9KSksci5oZXh9LGUuZ2V0Q29sb3IucmVzZXQ9ZnVuY3Rpb24oKXtkZWxldGUgdGhpcy5zdGFydH0sZS5wYXJzZVBhdGhTdHJpbmc9ZnVuY3Rpb24odCl7aWYoIXQpcmV0dXJuIG51bGw7dmFyIHI9VnQodCk7aWYoci5hcnIpcmV0dXJuIFl0KHIuYXJyKTt2YXIgaT17YTo3LGM6NixoOjEsbDoyLG06MixyOjQscTo0LHM6NCx0OjIsdjoxLHo6MH0sbj1bXTtyZXR1cm4gZS5pcyh0LFEpJiZlLmlzKHRbMF0sUSkmJihuPVl0KHQpKSxuLmxlbmd0aHx8aih0KS5yZXBsYWNlKHl0LGZ1bmN0aW9uKHQsZSxyKXt2YXIgYT1bXSxzPWUudG9Mb3dlckNhc2UoKTtpZihyLnJlcGxhY2UoYnQsZnVuY3Rpb24odCxlKXtlJiZhLnB1c2goK2UpfSksXCJtXCI9PXMmJmEubGVuZ3RoPjImJihuLnB1c2goW2VdW1BdKGEuc3BsaWNlKDAsMikpKSxzPVwibFwiLGU9XCJtXCI9PWU/XCJsXCI6XCJMXCIpLFwiclwiPT1zKW4ucHVzaChbZV1bUF0oYSkpO2Vsc2UgZm9yKDthLmxlbmd0aD49aVtzXSYmKG4ucHVzaChbZV1bUF0oYS5zcGxpY2UoMCxpW3NdKSkpLGlbc10pOyk7fSksbi50b1N0cmluZz1lLl9wYXRoMnN0cmluZyxyLmFycj1ZdChuKSxufSxlLnBhcnNlVHJhbnNmb3JtU3RyaW5nPW4oZnVuY3Rpb24odCl7aWYoIXQpcmV0dXJuIG51bGw7dmFyIHI9e3I6MyxzOjQsdDoyLG06Nn0saT1bXTtyZXR1cm4gZS5pcyh0LFEpJiZlLmlzKHRbMF0sUSkmJihpPVl0KHQpKSxpLmxlbmd0aHx8aih0KS5yZXBsYWNlKG10LGZ1bmN0aW9uKHQsZSxyKXt2YXIgbj1bXSxhPU8uY2FsbChlKTtyLnJlcGxhY2UoYnQsZnVuY3Rpb24odCxlKXtlJiZuLnB1c2goK2UpfSksaS5wdXNoKFtlXVtQXShuKSl9KSxpLnRvU3RyaW5nPWUuX3BhdGgyc3RyaW5nLGl9KTt2YXIgVnQ9ZnVuY3Rpb24odCl7dmFyIGU9VnQucHM9VnQucHN8fHt9O3JldHVybiBlW3RdP2VbdF0uc2xlZXA9MTAwOmVbdF09e3NsZWVwOjEwMH0sc2V0VGltZW91dChmdW5jdGlvbigpe2Zvcih2YXIgciBpbiBlKWVbVF0ocikmJnIhPXQmJihlW3JdLnNsZWVwLS0sIWVbcl0uc2xlZXAmJmRlbGV0ZSBlW3JdKX0pLGVbdF19O2UuZmluZERvdHNBdFNlZ21lbnQ9ZnVuY3Rpb24odCxlLHIsaSxuLGEscyxvLGwpe3ZhciBoPTEtbCx1PVgoaCwzKSxjPVgoaCwyKSxmPWwqbCxwPWYqbCxkPXUqdCszKmMqbCpyKzMqaCpsKmwqbitwKnMsZz11KmUrMypjKmwqaSszKmgqbCpsKmErcCpvLHg9dCsyKmwqKHItdCkrZioobi0yKnIrdCksdj1lKzIqbCooaS1lKStmKihhLTIqaStlKSx5PXIrMipsKihuLXIpK2YqKHMtMipuK3IpLG09aSsyKmwqKGEtaSkrZiooby0yKmEraSksYj1oKnQrbCpyLF89aCplK2wqaSx3PWgqbitsKnMsaz1oKmErbCpvLEI9OTAtMTgwKlkuYXRhbjIoeC15LHYtbSkvVTtyZXR1cm4oeD55fHxtPnYpJiYoQis9MTgwKSx7eDpkLHk6ZyxtOnt4OngseTp2fSxuOnt4OnkseTptfSxzdGFydDp7eDpiLHk6X30sZW5kOnt4OncseTprfSxhbHBoYTpCfX0sZS5iZXppZXJCQm94PWZ1bmN0aW9uKHQscixpLG4sYSxzLG8sbCl7ZS5pcyh0LFwiYXJyYXlcIil8fCh0PVt0LHIsaSxuLGEscyxvLGxdKTt2YXIgaD1adC5hcHBseShudWxsLHQpO3JldHVybnt4OmgubWluLngseTpoLm1pbi55LHgyOmgubWF4LngseTI6aC5tYXgueSx3aWR0aDpoLm1heC54LWgubWluLngsaGVpZ2h0OmgubWF4LnktaC5taW4ueX19LGUuaXNQb2ludEluc2lkZUJCb3g9ZnVuY3Rpb24odCxlLHIpe3JldHVybiBlPj10LngmJmU8PXQueDImJnI+PXQueSYmcjw9dC55Mn0sZS5pc0JCb3hJbnRlcnNlY3Q9ZnVuY3Rpb24odCxyKXt2YXIgaT1lLmlzUG9pbnRJbnNpZGVCQm94O3JldHVybiBpKHIsdC54LHQueSl8fGkocix0LngyLHQueSl8fGkocix0LngsdC55Mil8fGkocix0LngyLHQueTIpfHxpKHQsci54LHIueSl8fGkodCxyLngyLHIueSl8fGkodCxyLngsci55Mil8fGkodCxyLngyLHIueTIpfHwodC54PHIueDImJnQueD5yLnh8fHIueDx0LngyJiZyLng+dC54KSYmKHQueTxyLnkyJiZ0Lnk+ci55fHxyLnk8dC55MiYmci55PnQueSl9LGUucGF0aEludGVyc2VjdGlvbj1mdW5jdGlvbih0LGUpe3JldHVybiBkKHQsZSl9LGUucGF0aEludGVyc2VjdGlvbk51bWJlcj1mdW5jdGlvbih0LGUpe3JldHVybiBkKHQsZSwxKX0sZS5pc1BvaW50SW5zaWRlUGF0aD1mdW5jdGlvbih0LHIsaSl7dmFyIG49ZS5wYXRoQkJveCh0KTtyZXR1cm4gZS5pc1BvaW50SW5zaWRlQkJveChuLHIsaSkmJmQodCxbW1wiTVwiLHIsaV0sW1wiSFwiLG4ueDIrMTBdXSwxKSUyPT0xfSxlLl9yZW1vdmVkRmFjdG9yeT1mdW5jdGlvbihlKXtyZXR1cm4gZnVuY3Rpb24oKXt0KFwicmFwaGFlbC5sb2dcIixudWxsLFwiUmFwaGHDq2w6IHlvdSBhcmUgY2FsbGluZyB0byBtZXRob2Qg4oCcXCIrZStcIuKAnSBvZiByZW1vdmVkIG9iamVjdFwiLGUpfX07dmFyIE90PWUucGF0aEJCb3g9ZnVuY3Rpb24odCl7dmFyIGU9VnQodCk7aWYoZS5iYm94KXJldHVybiByKGUuYmJveCk7aWYoIXQpcmV0dXJue3g6MCx5OjAsd2lkdGg6MCxoZWlnaHQ6MCx4MjowLHkyOjB9O3Q9UXQodCk7Zm9yKHZhciBpPTAsbj0wLGE9W10scz1bXSxvLGw9MCxoPXQubGVuZ3RoO2g+bDtsKyspaWYobz10W2xdLFwiTVwiPT1vWzBdKWk9b1sxXSxuPW9bMl0sYS5wdXNoKGkpLHMucHVzaChuKTtlbHNle3ZhciB1PVp0KGksbixvWzFdLG9bMl0sb1szXSxvWzRdLG9bNV0sb1s2XSk7YT1hW1BdKHUubWluLngsdS5tYXgueCkscz1zW1BdKHUubWluLnksdS5tYXgueSksaT1vWzVdLG49b1s2XX12YXIgYz1HW3pdKDAsYSksZj1HW3pdKDAscykscD1XW3pdKDAsYSksZD1XW3pdKDAscyksZz1wLWMseD1kLWYsdj17eDpjLHk6Zix4MjpwLHkyOmQsd2lkdGg6ZyxoZWlnaHQ6eCxjeDpjK2cvMixjeTpmK3gvMn07cmV0dXJuIGUuYmJveD1yKHYpLHZ9LFl0PWZ1bmN0aW9uKHQpe3ZhciBpPXIodCk7cmV0dXJuIGkudG9TdHJpbmc9ZS5fcGF0aDJzdHJpbmcsaX0sV3Q9ZS5fcGF0aFRvUmVsYXRpdmU9ZnVuY3Rpb24odCl7dmFyIHI9VnQodCk7aWYoci5yZWwpcmV0dXJuIFl0KHIucmVsKTtlLmlzKHQsUSkmJmUuaXModCYmdFswXSxRKXx8KHQ9ZS5wYXJzZVBhdGhTdHJpbmcodCkpO3ZhciBpPVtdLG49MCxhPTAscz0wLG89MCxsPTA7XCJNXCI9PXRbMF1bMF0mJihuPXRbMF1bMV0sYT10WzBdWzJdLHM9bixvPWEsbCsrLGkucHVzaChbXCJNXCIsbixhXSkpO2Zvcih2YXIgaD1sLHU9dC5sZW5ndGg7dT5oO2grKyl7dmFyIGM9aVtoXT1bXSxmPXRbaF07aWYoZlswXSE9Ty5jYWxsKGZbMF0pKXN3aXRjaChjWzBdPU8uY2FsbChmWzBdKSxjWzBdKXtjYXNlXCJhXCI6Y1sxXT1mWzFdLGNbMl09ZlsyXSxjWzNdPWZbM10sY1s0XT1mWzRdLGNbNV09Zls1XSxjWzZdPSsoZls2XS1uKS50b0ZpeGVkKDMpLGNbN109KyhmWzddLWEpLnRvRml4ZWQoMyk7YnJlYWs7Y2FzZVwidlwiOmNbMV09KyhmWzFdLWEpLnRvRml4ZWQoMyk7YnJlYWs7Y2FzZVwibVwiOnM9ZlsxXSxvPWZbMl07ZGVmYXVsdDpmb3IodmFyIHA9MSxkPWYubGVuZ3RoO2Q+cDtwKyspY1twXT0rKGZbcF0tKHAlMj9uOmEpKS50b0ZpeGVkKDMpfWVsc2V7Yz1pW2hdPVtdLFwibVwiPT1mWzBdJiYocz1mWzFdK24sbz1mWzJdK2EpO2Zvcih2YXIgZz0wLHg9Zi5sZW5ndGg7eD5nO2crKylpW2hdW2ddPWZbZ119dmFyIHY9aVtoXS5sZW5ndGg7c3dpdGNoKGlbaF1bMF0pe2Nhc2VcInpcIjpuPXMsYT1vO2JyZWFrO2Nhc2VcImhcIjpuKz0raVtoXVt2LTFdO2JyZWFrO2Nhc2VcInZcIjphKz0raVtoXVt2LTFdO2JyZWFrO2RlZmF1bHQ6bis9K2lbaF1bdi0yXSxhKz0raVtoXVt2LTFdfX1yZXR1cm4gaS50b1N0cmluZz1lLl9wYXRoMnN0cmluZyxyLnJlbD1ZdChpKSxpfSxHdD1lLl9wYXRoVG9BYnNvbHV0ZT1mdW5jdGlvbih0KXt2YXIgcj1WdCh0KTtpZihyLmFicylyZXR1cm4gWXQoci5hYnMpO2lmKGUuaXModCxRKSYmZS5pcyh0JiZ0WzBdLFEpfHwodD1lLnBhcnNlUGF0aFN0cmluZyh0KSksIXR8fCF0Lmxlbmd0aClyZXR1cm5bW1wiTVwiLDAsMF1dO3ZhciBpPVtdLG49MCxhPTAsbz0wLGw9MCxoPTA7XCJNXCI9PXRbMF1bMF0mJihuPSt0WzBdWzFdLGE9K3RbMF1bMl0sbz1uLGw9YSxoKyssaVswXT1bXCJNXCIsbixhXSk7Zm9yKHZhciB1PTM9PXQubGVuZ3RoJiZcIk1cIj09dFswXVswXSYmXCJSXCI9PXRbMV1bMF0udG9VcHBlckNhc2UoKSYmXCJaXCI9PXRbMl1bMF0udG9VcHBlckNhc2UoKSxjLGYscD1oLGQ9dC5sZW5ndGg7ZD5wO3ArKyl7aWYoaS5wdXNoKGM9W10pLGY9dFtwXSxmWzBdIT1jdC5jYWxsKGZbMF0pKXN3aXRjaChjWzBdPWN0LmNhbGwoZlswXSksY1swXSl7Y2FzZVwiQVwiOmNbMV09ZlsxXSxjWzJdPWZbMl0sY1szXT1mWzNdLGNbNF09Zls0XSxjWzVdPWZbNV0sY1s2XT0rKGZbNl0rbiksY1s3XT0rKGZbN10rYSk7YnJlYWs7Y2FzZVwiVlwiOmNbMV09K2ZbMV0rYTticmVhaztjYXNlXCJIXCI6Y1sxXT0rZlsxXStuO2JyZWFrO2Nhc2VcIlJcIjpmb3IodmFyIGc9W24sYV1bUF0oZi5zbGljZSgxKSkseD0yLHY9Zy5sZW5ndGg7dj54O3grKylnW3hdPStnW3hdK24sZ1srK3hdPStnW3hdK2E7aS5wb3AoKSxpPWlbUF0ocyhnLHUpKTticmVhaztjYXNlXCJNXCI6bz0rZlsxXStuLGw9K2ZbMl0rYTtkZWZhdWx0OmZvcih4PTEsdj1mLmxlbmd0aDt2Png7eCsrKWNbeF09K2ZbeF0rKHglMj9uOmEpfWVsc2UgaWYoXCJSXCI9PWZbMF0pZz1bbixhXVtQXShmLnNsaWNlKDEpKSxpLnBvcCgpLGk9aVtQXShzKGcsdSkpLGM9W1wiUlwiXVtQXShmLnNsaWNlKC0yKSk7ZWxzZSBmb3IodmFyIHk9MCxtPWYubGVuZ3RoO20+eTt5KyspY1t5XT1mW3ldO3N3aXRjaChjWzBdKXtjYXNlXCJaXCI6bj1vLGE9bDticmVhaztjYXNlXCJIXCI6bj1jWzFdO2JyZWFrO2Nhc2VcIlZcIjphPWNbMV07YnJlYWs7Y2FzZVwiTVwiOm89Y1tjLmxlbmd0aC0yXSxsPWNbYy5sZW5ndGgtMV07ZGVmYXVsdDpuPWNbYy5sZW5ndGgtMl0sYT1jW2MubGVuZ3RoLTFdfX1yZXR1cm4gaS50b1N0cmluZz1lLl9wYXRoMnN0cmluZyxyLmFicz1ZdChpKSxpfSxIdD1mdW5jdGlvbih0LGUscixpKXtyZXR1cm5bdCxlLHIsaSxyLGldfSxYdD1mdW5jdGlvbih0LGUscixpLG4sYSl7dmFyIHM9MS8zLG89Mi8zO3JldHVybltzKnQrbypyLHMqZStvKmkscypuK28qcixzKmErbyppLG4sYV19LFV0PWZ1bmN0aW9uKHQsZSxyLGksYSxzLG8sbCxoLHUpe3ZhciBjPTEyMCpVLzE4MCxmPVUvMTgwKigrYXx8MCkscD1bXSxkLGc9bihmdW5jdGlvbih0LGUscil7dmFyIGk9dCpZLmNvcyhyKS1lKlkuc2luKHIpLG49dCpZLnNpbihyKStlKlkuY29zKHIpO3JldHVybnt4OmkseTpufX0pO2lmKHUpUz11WzBdLFQ9dVsxXSxCPXVbMl0sQz11WzNdO2Vsc2V7ZD1nKHQsZSwtZiksdD1kLngsZT1kLnksZD1nKGwsaCwtZiksbD1kLngsaD1kLnk7dmFyIHg9WS5jb3MoVS8xODAqYSksdj1ZLnNpbihVLzE4MCphKSx5PSh0LWwpLzIsbT0oZS1oKS8yLGI9eSp5LyhyKnIpK20qbS8oaSppKTtiPjEmJihiPVkuc3FydChiKSxyPWIqcixpPWIqaSk7dmFyIF89cipyLHc9aSppLGs9KHM9PW8/LTE6MSkqWS5zcXJ0KEgoKF8qdy1fKm0qbS13KnkqeSkvKF8qbSptK3cqeSp5KSkpLEI9aypyKm0vaSsodCtsKS8yLEM9ayotaSp5L3IrKGUraCkvMixTPVkuYXNpbigoKGUtQykvaSkudG9GaXhlZCg5KSksVD1ZLmFzaW4oKChoLUMpL2kpLnRvRml4ZWQoOSkpO1M9Qj50P1UtUzpTLFQ9Qj5sP1UtVDpULDA+UyYmKFM9MipVK1MpLDA+VCYmKFQ9MipVK1QpLG8mJlM+VCYmKFMtPTIqVSksIW8mJlQ+UyYmKFQtPTIqVSl9dmFyIEE9VC1TO2lmKEgoQSk+Yyl7dmFyIEU9VCxOPWwsTT1oO1Q9UytjKihvJiZUPlM/MTotMSksbD1CK3IqWS5jb3MoVCksaD1DK2kqWS5zaW4oVCkscD1VdChsLGgscixpLGEsMCxvLE4sTSxbVCxFLEIsQ10pfUE9VC1TO3ZhciBMPVkuY29zKFMpLHo9WS5zaW4oUyksRj1ZLmNvcyhUKSxSPVkuc2luKFQpLEk9WS50YW4oQS80KSxqPTQvMypyKkksRD00LzMqaSpJLFY9W3QsZV0sTz1bdCtqKnosZS1EKkxdLFc9W2wraipSLGgtRCpGXSxHPVtsLGhdO2lmKE9bMF09MipWWzBdLU9bMF0sT1sxXT0yKlZbMV0tT1sxXSx1KXJldHVybltPLFcsR11bUF0ocCk7cD1bTyxXLEddW1BdKHApLmpvaW4oKVtxXShcIixcIik7Zm9yKHZhciBYPVtdLCQ9MCxaPXAubGVuZ3RoO1o+JDskKyspWFskXT0kJTI/ZyhwWyQtMV0scFskXSxmKS55OmcocFskXSxwWyQrMV0sZikueDtyZXR1cm4gWH0sJHQ9ZnVuY3Rpb24odCxlLHIsaSxuLGEscyxvLGwpe3ZhciBoPTEtbDtyZXR1cm57eDpYKGgsMykqdCszKlgoaCwyKSpsKnIrMypoKmwqbCpuK1gobCwzKSpzLHk6WChoLDMpKmUrMypYKGgsMikqbCppKzMqaCpsKmwqYStYKGwsMykqb319LFp0PW4oZnVuY3Rpb24odCxlLHIsaSxuLGEscyxvKXt2YXIgbD1uLTIqcit0LShzLTIqbityKSxoPTIqKHItdCktMioobi1yKSx1PXQtcixjPSgtaCtZLnNxcnQoaCpoLTQqbCp1KSkvMi9sLGY9KC1oLVkuc3FydChoKmgtNCpsKnUpKS8yL2wscD1bZSxvXSxkPVt0LHNdLGc7cmV0dXJuIEgoYyk+XCIxZTEyXCImJihjPS41KSxIKGYpPlwiMWUxMlwiJiYoZj0uNSksYz4wJiYxPmMmJihnPSR0KHQsZSxyLGksbixhLHMsbyxjKSxkLnB1c2goZy54KSxwLnB1c2goZy55KSksZj4wJiYxPmYmJihnPSR0KHQsZSxyLGksbixhLHMsbyxmKSxkLnB1c2goZy54KSxwLnB1c2goZy55KSksbD1hLTIqaStlLShvLTIqYStpKSxoPTIqKGktZSktMiooYS1pKSx1PWUtaSxjPSgtaCtZLnNxcnQoaCpoLTQqbCp1KSkvMi9sLGY9KC1oLVkuc3FydChoKmgtNCpsKnUpKS8yL2wsSChjKT5cIjFlMTJcIiYmKGM9LjUpLEgoZik+XCIxZTEyXCImJihmPS41KSxjPjAmJjE+YyYmKGc9JHQodCxlLHIsaSxuLGEscyxvLGMpLGQucHVzaChnLngpLHAucHVzaChnLnkpKSxmPjAmJjE+ZiYmKGc9JHQodCxlLHIsaSxuLGEscyxvLGYpLGQucHVzaChnLngpLHAucHVzaChnLnkpKSx7bWluOnt4Okdbel0oMCxkKSx5Okdbel0oMCxwKX0sbWF4Ont4Oldbel0oMCxkKSx5Oldbel0oMCxwKX19fSksUXQ9ZS5fcGF0aDJjdXJ2ZT1uKGZ1bmN0aW9uKHQsZSl7dmFyIHI9IWUmJlZ0KHQpO2lmKCFlJiZyLmN1cnZlKXJldHVybiBZdChyLmN1cnZlKTtmb3IodmFyIGk9R3QodCksbj1lJiZHdChlKSxhPXt4OjAseTowLGJ4OjAsYnk6MCxYOjAsWTowLHF4Om51bGwscXk6bnVsbH0scz17eDowLHk6MCxieDowLGJ5OjAsWDowLFk6MCxxeDpudWxsLHF5Om51bGx9LG89KGZ1bmN0aW9uKHQsZSxyKXt2YXIgaSxuLGE9e1Q6MSxROjF9O2lmKCF0KXJldHVybltcIkNcIixlLngsZS55LGUueCxlLnksZS54LGUueV07c3dpdGNoKCEodFswXWluIGEpJiYoZS5xeD1lLnF5PW51bGwpLHRbMF0pe2Nhc2VcIk1cIjplLlg9dFsxXSxlLlk9dFsyXTticmVhaztjYXNlXCJBXCI6dD1bXCJDXCJdW1BdKFV0W3pdKDAsW2UueCxlLnldW1BdKHQuc2xpY2UoMSkpKSk7YnJlYWs7Y2FzZVwiU1wiOlwiQ1wiPT1yfHxcIlNcIj09cj8oaT0yKmUueC1lLmJ4LG49MiplLnktZS5ieSk6KGk9ZS54LG49ZS55KSx0PVtcIkNcIixpLG5dW1BdKHQuc2xpY2UoMSkpO2JyZWFrO2Nhc2VcIlRcIjpcIlFcIj09cnx8XCJUXCI9PXI/KGUucXg9MiplLngtZS5xeCxlLnF5PTIqZS55LWUucXkpOihlLnF4PWUueCxlLnF5PWUueSksdD1bXCJDXCJdW1BdKFh0KGUueCxlLnksZS5xeCxlLnF5LHRbMV0sdFsyXSkpO2JyZWFrO2Nhc2VcIlFcIjplLnF4PXRbMV0sZS5xeT10WzJdLHQ9W1wiQ1wiXVtQXShYdChlLngsZS55LHRbMV0sdFsyXSx0WzNdLHRbNF0pKTticmVhaztjYXNlXCJMXCI6dD1bXCJDXCJdW1BdKEh0KGUueCxlLnksdFsxXSx0WzJdKSk7YnJlYWs7Y2FzZVwiSFwiOnQ9W1wiQ1wiXVtQXShIdChlLngsZS55LHRbMV0sZS55KSk7YnJlYWs7Y2FzZVwiVlwiOnQ9W1wiQ1wiXVtQXShIdChlLngsZS55LGUueCx0WzFdKSk7YnJlYWs7Y2FzZVwiWlwiOnQ9W1wiQ1wiXVtQXShIdChlLngsZS55LGUuWCxlLlkpKX1yZXR1cm4gdH0pLGw9ZnVuY3Rpb24odCxlKXtpZih0W2VdLmxlbmd0aD43KXt0W2VdLnNoaWZ0KCk7Zm9yKHZhciByPXRbZV07ci5sZW5ndGg7KXVbZV09XCJBXCIsbiYmKGNbZV09XCJBXCIpLHQuc3BsaWNlKGUrKywwLFtcIkNcIl1bUF0oci5zcGxpY2UoMCw2KSkpO3Quc3BsaWNlKGUsMSksZz1XKGkubGVuZ3RoLG4mJm4ubGVuZ3RofHwwKX19LGg9ZnVuY3Rpb24odCxlLHIsYSxzKXt0JiZlJiZcIk1cIj09dFtzXVswXSYmXCJNXCIhPWVbc11bMF0mJihlLnNwbGljZShzLDAsW1wiTVwiLGEueCxhLnldKSxyLmJ4PTAsci5ieT0wLHIueD10W3NdWzFdLHIueT10W3NdWzJdLGc9VyhpLmxlbmd0aCxuJiZuLmxlbmd0aHx8MCkpfSx1PVtdLGM9W10sZj1cIlwiLHA9XCJcIixkPTAsZz1XKGkubGVuZ3RoLG4mJm4ubGVuZ3RofHwwKTtnPmQ7ZCsrKXtpW2RdJiYoZj1pW2RdWzBdKSxcIkNcIiE9ZiYmKHVbZF09ZixkJiYocD11W2QtMV0pKSxpW2RdPW8oaVtkXSxhLHApLFwiQVwiIT11W2RdJiZcIkNcIj09ZiYmKHVbZF09XCJDXCIpLGwoaSxkKSxuJiYobltkXSYmKGY9bltkXVswXSksXCJDXCIhPWYmJihjW2RdPWYsZCYmKHA9Y1tkLTFdKSksbltkXT1vKG5bZF0scyxwKSxcIkFcIiE9Y1tkXSYmXCJDXCI9PWYmJihjW2RdPVwiQ1wiKSxsKG4sZCkpLGgoaSxuLGEscyxkKSxoKG4saSxzLGEsZCk7dmFyIHg9aVtkXSx2PW4mJm5bZF0seT14Lmxlbmd0aCxtPW4mJnYubGVuZ3RoO2EueD14W3ktMl0sYS55PXhbeS0xXSxhLmJ4PWh0KHhbeS00XSl8fGEueCxhLmJ5PWh0KHhbeS0zXSl8fGEueSxzLmJ4PW4mJihodCh2W20tNF0pfHxzLngpLHMuYnk9biYmKGh0KHZbbS0zXSl8fHMueSkscy54PW4mJnZbbS0yXSxzLnk9biYmdlttLTFdfXJldHVybiBufHwoci5jdXJ2ZT1ZdChpKSksbj9baSxuXTppfSxudWxsLFl0KSxKdD1lLl9wYXJzZURvdHM9bihmdW5jdGlvbih0KXtmb3IodmFyIHI9W10saT0wLG49dC5sZW5ndGg7bj5pO2krKyl7dmFyIGE9e30scz10W2ldLm1hdGNoKC9eKFteOl0qKTo/KFtcXGRcXC5dKikvKTtpZihhLmNvbG9yPWUuZ2V0UkdCKHNbMV0pLGEuY29sb3IuZXJyb3IpcmV0dXJuIG51bGw7YS5vcGFjaXR5PWEuY29sb3Iub3BhY2l0eSxhLmNvbG9yPWEuY29sb3IuaGV4LHNbMl0mJihhLm9mZnNldD1zWzJdK1wiJVwiKSxyLnB1c2goYSl9Zm9yKGk9MSxuPXIubGVuZ3RoLTE7bj5pO2krKylpZighcltpXS5vZmZzZXQpe2Zvcih2YXIgbz1odChyW2ktMV0ub2Zmc2V0fHwwKSxsPTAsaD1pKzE7bj5oO2grKylpZihyW2hdLm9mZnNldCl7bD1yW2hdLm9mZnNldDticmVha31sfHwobD0xMDAsaD1uKSxsPWh0KGwpO2Zvcih2YXIgdT0obC1vKS8oaC1pKzEpO2g+aTtpKyspbys9dSxyW2ldLm9mZnNldD1vK1wiJVwifXJldHVybiByfSksS3Q9ZS5fdGVhcj1mdW5jdGlvbih0LGUpe3Q9PWUudG9wJiYoZS50b3A9dC5wcmV2KSx0PT1lLmJvdHRvbSYmKGUuYm90dG9tPXQubmV4dCksdC5uZXh0JiYodC5uZXh0LnByZXY9dC5wcmV2KSx0LnByZXYmJih0LnByZXYubmV4dD10Lm5leHQpfSx0ZT1lLl90b2Zyb250PWZ1bmN0aW9uKHQsZSl7ZS50b3AhPT10JiYoS3QodCxlKSx0Lm5leHQ9bnVsbCx0LnByZXY9ZS50b3AsZS50b3AubmV4dD10LGUudG9wPXQpfSxlZT1lLl90b2JhY2s9ZnVuY3Rpb24odCxlKXtlLmJvdHRvbSE9PXQmJihLdCh0LGUpLHQubmV4dD1lLmJvdHRvbSx0LnByZXY9bnVsbCxlLmJvdHRvbS5wcmV2PXQsZS5ib3R0b209dCl9LHJlPWUuX2luc2VydGFmdGVyPWZ1bmN0aW9uKHQsZSxyKXtLdCh0LHIpLGU9PXIudG9wJiYoci50b3A9dCksZS5uZXh0JiYoZS5uZXh0LnByZXY9dCksdC5uZXh0PWUubmV4dCx0LnByZXY9ZSxlLm5leHQ9dH0saWU9ZS5faW5zZXJ0YmVmb3JlPWZ1bmN0aW9uKHQsZSxyKXtLdCh0LHIpLGU9PXIuYm90dG9tJiYoci5ib3R0b209dCksZS5wcmV2JiYoZS5wcmV2Lm5leHQ9dCksdC5wcmV2PWUucHJldixlLnByZXY9dCx0Lm5leHQ9ZX0sbmU9ZS50b01hdHJpeD1mdW5jdGlvbih0LGUpe3ZhciByPU90KHQpLGk9e186e3RyYW5zZm9ybTpSfSxnZXRCQm94OmZ1bmN0aW9uKCl7cmV0dXJuIHJ9fTtyZXR1cm4gc2UoaSxlKSxpLm1hdHJpeH0sYWU9ZS50cmFuc2Zvcm1QYXRoPWZ1bmN0aW9uKHQsZSl7cmV0dXJuIE50KHQsbmUodCxlKSl9LHNlPWUuX2V4dHJhY3RUcmFuc2Zvcm09ZnVuY3Rpb24odCxyKXtpZihudWxsPT1yKXJldHVybiB0Ll8udHJhbnNmb3JtO3I9aihyKS5yZXBsYWNlKC9cXC57M318XFx1MjAyNi9nLHQuXy50cmFuc2Zvcm18fFIpO3ZhciBpPWUucGFyc2VUcmFuc2Zvcm1TdHJpbmcociksbj0wLGE9MCxzPTAsbz0xLGw9MSxoPXQuXyx1PW5ldyBnO2lmKGgudHJhbnNmb3JtPWl8fFtdLGkpZm9yKHZhciBjPTAsZj1pLmxlbmd0aDtmPmM7YysrKXt2YXIgcD1pW2NdLGQ9cC5sZW5ndGgseD1qKHBbMF0pLnRvTG93ZXJDYXNlKCksdj1wWzBdIT14LHk9dj91LmludmVydCgpOjAsbSxiLF8sdyxrO1widFwiPT14JiYzPT1kP3Y/KG09eS54KDAsMCksYj15LnkoMCwwKSxfPXkueChwWzFdLHBbMl0pLHc9eS55KHBbMV0scFsyXSksdS50cmFuc2xhdGUoXy1tLHctYikpOnUudHJhbnNsYXRlKHBbMV0scFsyXSk6XCJyXCI9PXg/Mj09ZD8oaz1rfHx0LmdldEJCb3goMSksdS5yb3RhdGUocFsxXSxrLngray53aWR0aC8yLGsueStrLmhlaWdodC8yKSxuKz1wWzFdKTo0PT1kJiYodj8oXz15LngocFsyXSxwWzNdKSx3PXkueShwWzJdLHBbM10pLHUucm90YXRlKHBbMV0sXyx3KSk6dS5yb3RhdGUocFsxXSxwWzJdLHBbM10pLG4rPXBbMV0pOlwic1wiPT14PzI9PWR8fDM9PWQ/KGs9a3x8dC5nZXRCQm94KDEpLHUuc2NhbGUocFsxXSxwW2QtMV0say54K2sud2lkdGgvMixrLnkray5oZWlnaHQvMiksbyo9cFsxXSxsKj1wW2QtMV0pOjU9PWQmJih2PyhfPXkueChwWzNdLHBbNF0pLHc9eS55KHBbM10scFs0XSksdS5zY2FsZShwWzFdLHBbMl0sXyx3KSk6dS5zY2FsZShwWzFdLHBbMl0scFszXSxwWzRdKSxvKj1wWzFdLGwqPXBbMl0pOlwibVwiPT14JiY3PT1kJiZ1LmFkZChwWzFdLHBbMl0scFszXSxwWzRdLHBbNV0scFs2XSksaC5kaXJ0eVQ9MSx0Lm1hdHJpeD11fXQubWF0cml4PXUsaC5zeD1vLGguc3k9bCxoLmRlZz1uLGguZHg9YT11LmUsaC5keT1zPXUuZiwxPT1vJiYxPT1sJiYhbiYmaC5iYm94PyhoLmJib3gueCs9K2EsaC5iYm94LnkrPStzKTpoLmRpcnR5VD0xfSxvZT1mdW5jdGlvbih0KXt2YXIgZT10WzBdO3N3aXRjaChlLnRvTG93ZXJDYXNlKCkpe2Nhc2VcInRcIjpyZXR1cm5bZSwwLDBdO2Nhc2VcIm1cIjpyZXR1cm5bZSwxLDAsMCwxLDAsMF07Y2FzZVwiclwiOnJldHVybiA0PT10Lmxlbmd0aD9bZSwwLHRbMl0sdFszXV06W2UsMF07Y2FzZVwic1wiOnJldHVybiA1PT10Lmxlbmd0aD9bZSwxLDEsdFszXSx0WzRdXTozPT10Lmxlbmd0aD9bZSwxLDFdOltlLDFdfX0sbGU9ZS5fZXF1YWxpc2VUcmFuc2Zvcm09ZnVuY3Rpb24odCxyKXtyPWoocikucmVwbGFjZSgvXFwuezN9fFxcdTIwMjYvZyx0KSx0PWUucGFyc2VUcmFuc2Zvcm1TdHJpbmcodCl8fFtdLHI9ZS5wYXJzZVRyYW5zZm9ybVN0cmluZyhyKXx8W107Zm9yKHZhciBpPVcodC5sZW5ndGgsci5sZW5ndGgpLG49W10sYT1bXSxzPTAsbyxsLGgsdTtpPnM7cysrKXtpZihoPXRbc118fG9lKHJbc10pLHU9cltzXXx8b2UoaCksaFswXSE9dVswXXx8XCJyXCI9PWhbMF0udG9Mb3dlckNhc2UoKSYmKGhbMl0hPXVbMl18fGhbM10hPXVbM10pfHxcInNcIj09aFswXS50b0xvd2VyQ2FzZSgpJiYoaFszXSE9dVszXXx8aFs0XSE9dVs0XSkpcmV0dXJuO2ZvcihuW3NdPVtdLGFbc109W10sbz0wLGw9VyhoLmxlbmd0aCx1Lmxlbmd0aCk7bD5vO28rKylvIGluIGgmJihuW3NdW29dPWhbb10pLG8gaW4gdSYmKGFbc11bb109dVtvXSl9cmV0dXJue2Zyb206bix0bzphfX07ZS5fZ2V0Q29udGFpbmVyPWZ1bmN0aW9uKHQscixpLG4pe3ZhciBhO3JldHVybiBhPW51bGwhPW58fGUuaXModCxcIm9iamVjdFwiKT90OkEuZG9jLmdldEVsZW1lbnRCeUlkKHQpLG51bGwhPWE/YS50YWdOYW1lP251bGw9PXI/e2NvbnRhaW5lcjphLHdpZHRoOmEuc3R5bGUucGl4ZWxXaWR0aHx8YS5vZmZzZXRXaWR0aCxoZWlnaHQ6YS5zdHlsZS5waXhlbEhlaWdodHx8YS5vZmZzZXRIZWlnaHR9Ontjb250YWluZXI6YSx3aWR0aDpyLGhlaWdodDppfTp7Y29udGFpbmVyOjEseDp0LHk6cix3aWR0aDppLGhlaWdodDpufTp2b2lkIDB9LGUucGF0aFRvUmVsYXRpdmU9V3QsZS5fZW5naW5lPXt9LGUucGF0aDJjdXJ2ZT1RdCxlLm1hdHJpeD1mdW5jdGlvbih0LGUscixpLG4sYSl7cmV0dXJuIG5ldyBnKHQsZSxyLGksbixhKX0sZnVuY3Rpb24odCl7ZnVuY3Rpb24gcih0KXtyZXR1cm4gdFswXSp0WzBdK3RbMV0qdFsxXX1mdW5jdGlvbiBpKHQpe3ZhciBlPVkuc3FydChyKHQpKTt0WzBdJiYodFswXS89ZSksdFsxXSYmKHRbMV0vPWUpfXQuYWRkPWZ1bmN0aW9uKHQsZSxyLGksbixhKXt2YXIgcz1bW10sW10sW11dLG89W1t0aGlzLmEsdGhpcy5jLHRoaXMuZV0sW3RoaXMuYix0aGlzLmQsdGhpcy5mXSxbMCwwLDFdXSxsPVtbdCxyLG5dLFtlLGksYV0sWzAsMCwxXV0saCx1LGMsZjtmb3IodCYmdCBpbnN0YW5jZW9mIGcmJihsPVtbdC5hLHQuYyx0LmVdLFt0LmIsdC5kLHQuZl0sWzAsMCwxXV0pLGg9MDszPmg7aCsrKWZvcih1PTA7Mz51O3UrKyl7Zm9yKGY9MCxjPTA7Mz5jO2MrKylmKz1vW2hdW2NdKmxbY11bdV07c1toXVt1XT1mfXRoaXMuYT1zWzBdWzBdLHRoaXMuYj1zWzFdWzBdLHRoaXMuYz1zWzBdWzFdLHRoaXMuZD1zWzFdWzFdLHRoaXMuZT1zWzBdWzJdLHRoaXMuZj1zWzFdWzJdfSx0LmludmVydD1mdW5jdGlvbigpe3ZhciB0PXRoaXMsZT10LmEqdC5kLXQuYip0LmM7cmV0dXJuIG5ldyBnKHQuZC9lLC10LmIvZSwtdC5jL2UsdC5hL2UsKHQuYyp0LmYtdC5kKnQuZSkvZSwodC5iKnQuZS10LmEqdC5mKS9lKX0sdC5jbG9uZT1mdW5jdGlvbigpe3JldHVybiBuZXcgZyh0aGlzLmEsdGhpcy5iLHRoaXMuYyx0aGlzLmQsdGhpcy5lLHRoaXMuZil9LHQudHJhbnNsYXRlPWZ1bmN0aW9uKHQsZSl7XG50aGlzLmFkZCgxLDAsMCwxLHQsZSl9LHQuc2NhbGU9ZnVuY3Rpb24odCxlLHIsaSl7bnVsbD09ZSYmKGU9dCksKHJ8fGkpJiZ0aGlzLmFkZCgxLDAsMCwxLHIsaSksdGhpcy5hZGQodCwwLDAsZSwwLDApLChyfHxpKSYmdGhpcy5hZGQoMSwwLDAsMSwtciwtaSl9LHQucm90YXRlPWZ1bmN0aW9uKHQscixpKXt0PWUucmFkKHQpLHI9cnx8MCxpPWl8fDA7dmFyIG49K1kuY29zKHQpLnRvRml4ZWQoOSksYT0rWS5zaW4odCkudG9GaXhlZCg5KTt0aGlzLmFkZChuLGEsLWEsbixyLGkpLHRoaXMuYWRkKDEsMCwwLDEsLXIsLWkpfSx0Lng9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdCp0aGlzLmErZSp0aGlzLmMrdGhpcy5lfSx0Lnk9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdCp0aGlzLmIrZSp0aGlzLmQrdGhpcy5mfSx0LmdldD1mdW5jdGlvbih0KXtyZXR1cm4rdGhpc1tqLmZyb21DaGFyQ29kZSg5Nyt0KV0udG9GaXhlZCg0KX0sdC50b1N0cmluZz1mdW5jdGlvbigpe3JldHVybiBlLnN2Zz9cIm1hdHJpeChcIitbdGhpcy5nZXQoMCksdGhpcy5nZXQoMSksdGhpcy5nZXQoMiksdGhpcy5nZXQoMyksdGhpcy5nZXQoNCksdGhpcy5nZXQoNSldLmpvaW4oKStcIilcIjpbdGhpcy5nZXQoMCksdGhpcy5nZXQoMiksdGhpcy5nZXQoMSksdGhpcy5nZXQoMyksMCwwXS5qb2luKCl9LHQudG9GaWx0ZXI9ZnVuY3Rpb24oKXtyZXR1cm5cInByb2dpZDpEWEltYWdlVHJhbnNmb3JtLk1pY3Jvc29mdC5NYXRyaXgoTTExPVwiK3RoaXMuZ2V0KDApK1wiLCBNMTI9XCIrdGhpcy5nZXQoMikrXCIsIE0yMT1cIit0aGlzLmdldCgxKStcIiwgTTIyPVwiK3RoaXMuZ2V0KDMpK1wiLCBEeD1cIit0aGlzLmdldCg0KStcIiwgRHk9XCIrdGhpcy5nZXQoNSkrXCIsIHNpemluZ21ldGhvZD0nYXV0byBleHBhbmQnKVwifSx0Lm9mZnNldD1mdW5jdGlvbigpe3JldHVyblt0aGlzLmUudG9GaXhlZCg0KSx0aGlzLmYudG9GaXhlZCg0KV19LHQuc3BsaXQ9ZnVuY3Rpb24oKXt2YXIgdD17fTt0LmR4PXRoaXMuZSx0LmR5PXRoaXMuZjt2YXIgbj1bW3RoaXMuYSx0aGlzLmNdLFt0aGlzLmIsdGhpcy5kXV07dC5zY2FsZXg9WS5zcXJ0KHIoblswXSkpLGkoblswXSksdC5zaGVhcj1uWzBdWzBdKm5bMV1bMF0rblswXVsxXSpuWzFdWzFdLG5bMV09W25bMV1bMF0tblswXVswXSp0LnNoZWFyLG5bMV1bMV0tblswXVsxXSp0LnNoZWFyXSx0LnNjYWxleT1ZLnNxcnQocihuWzFdKSksaShuWzFdKSx0LnNoZWFyLz10LnNjYWxleTt2YXIgYT0tblswXVsxXSxzPW5bMV1bMV07cmV0dXJuIDA+cz8odC5yb3RhdGU9ZS5kZWcoWS5hY29zKHMpKSwwPmEmJih0LnJvdGF0ZT0zNjAtdC5yb3RhdGUpKTp0LnJvdGF0ZT1lLmRlZyhZLmFzaW4oYSkpLHQuaXNTaW1wbGU9ISgrdC5zaGVhci50b0ZpeGVkKDkpfHx0LnNjYWxleC50b0ZpeGVkKDkpIT10LnNjYWxleS50b0ZpeGVkKDkpJiZ0LnJvdGF0ZSksdC5pc1N1cGVyU2ltcGxlPSErdC5zaGVhci50b0ZpeGVkKDkpJiZ0LnNjYWxleC50b0ZpeGVkKDkpPT10LnNjYWxleS50b0ZpeGVkKDkpJiYhdC5yb3RhdGUsdC5ub1JvdGF0aW9uPSErdC5zaGVhci50b0ZpeGVkKDkpJiYhdC5yb3RhdGUsdH0sdC50b1RyYW5zZm9ybVN0cmluZz1mdW5jdGlvbih0KXt2YXIgZT10fHx0aGlzW3FdKCk7cmV0dXJuIGUuaXNTaW1wbGU/KGUuc2NhbGV4PStlLnNjYWxleC50b0ZpeGVkKDQpLGUuc2NhbGV5PStlLnNjYWxleS50b0ZpeGVkKDQpLGUucm90YXRlPStlLnJvdGF0ZS50b0ZpeGVkKDQpLChlLmR4fHxlLmR5P1widFwiK1tlLmR4LGUuZHldOlIpKygxIT1lLnNjYWxleHx8MSE9ZS5zY2FsZXk/XCJzXCIrW2Uuc2NhbGV4LGUuc2NhbGV5LDAsMF06UikrKGUucm90YXRlP1wiclwiK1tlLnJvdGF0ZSwwLDBdOlIpKTpcIm1cIitbdGhpcy5nZXQoMCksdGhpcy5nZXQoMSksdGhpcy5nZXQoMiksdGhpcy5nZXQoMyksdGhpcy5nZXQoNCksdGhpcy5nZXQoNSldfX0oZy5wcm90b3R5cGUpO2Zvcih2YXIgaGU9ZnVuY3Rpb24oKXt0aGlzLnJldHVyblZhbHVlPSExfSx1ZT1mdW5jdGlvbigpe3JldHVybiB0aGlzLm9yaWdpbmFsRXZlbnQucHJldmVudERlZmF1bHQoKX0sY2U9ZnVuY3Rpb24oKXt0aGlzLmNhbmNlbEJ1YmJsZT0hMH0sZmU9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5vcmlnaW5hbEV2ZW50LnN0b3BQcm9wYWdhdGlvbigpfSxwZT1mdW5jdGlvbih0KXt2YXIgZT1BLmRvYy5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wfHxBLmRvYy5ib2R5LnNjcm9sbFRvcCxyPUEuZG9jLmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0fHxBLmRvYy5ib2R5LnNjcm9sbExlZnQ7cmV0dXJue3g6dC5jbGllbnRYK3IseTp0LmNsaWVudFkrZX19LGRlPWZ1bmN0aW9uKCl7cmV0dXJuIEEuZG9jLmFkZEV2ZW50TGlzdGVuZXI/ZnVuY3Rpb24odCxlLHIsaSl7dmFyIG49ZnVuY3Rpb24odCl7dmFyIGU9cGUodCk7cmV0dXJuIHIuY2FsbChpLHQsZS54LGUueSl9O2lmKHQuYWRkRXZlbnRMaXN0ZW5lcihlLG4sITEpLEYmJlZbZV0pe3ZhciBhPWZ1bmN0aW9uKGUpe2Zvcih2YXIgbj1wZShlKSxhPWUscz0wLG89ZS50YXJnZXRUb3VjaGVzJiZlLnRhcmdldFRvdWNoZXMubGVuZ3RoO28+cztzKyspaWYoZS50YXJnZXRUb3VjaGVzW3NdLnRhcmdldD09dCl7ZT1lLnRhcmdldFRvdWNoZXNbc10sZS5vcmlnaW5hbEV2ZW50PWEsZS5wcmV2ZW50RGVmYXVsdD11ZSxlLnN0b3BQcm9wYWdhdGlvbj1mZTticmVha31yZXR1cm4gci5jYWxsKGksZSxuLngsbi55KX07dC5hZGRFdmVudExpc3RlbmVyKFZbZV0sYSwhMSl9cmV0dXJuIGZ1bmN0aW9uKCl7cmV0dXJuIHQucmVtb3ZlRXZlbnRMaXN0ZW5lcihlLG4sITEpLEYmJlZbZV0mJnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihWW2VdLGEsITEpLCEwfX06QS5kb2MuYXR0YWNoRXZlbnQ/ZnVuY3Rpb24odCxlLHIsaSl7dmFyIG49ZnVuY3Rpb24odCl7dD10fHxBLndpbi5ldmVudDt2YXIgZT1BLmRvYy5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wfHxBLmRvYy5ib2R5LnNjcm9sbFRvcCxuPUEuZG9jLmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0fHxBLmRvYy5ib2R5LnNjcm9sbExlZnQsYT10LmNsaWVudFgrbixzPXQuY2xpZW50WStlO3JldHVybiB0LnByZXZlbnREZWZhdWx0PXQucHJldmVudERlZmF1bHR8fGhlLHQuc3RvcFByb3BhZ2F0aW9uPXQuc3RvcFByb3BhZ2F0aW9ufHxjZSxyLmNhbGwoaSx0LGEscyl9O3QuYXR0YWNoRXZlbnQoXCJvblwiK2Usbik7dmFyIGE9ZnVuY3Rpb24oKXtyZXR1cm4gdC5kZXRhY2hFdmVudChcIm9uXCIrZSxuKSwhMH07cmV0dXJuIGF9OnZvaWQgMH0oKSxnZT1bXSx4ZT1mdW5jdGlvbihlKXtmb3IodmFyIHI9ZS5jbGllbnRYLGk9ZS5jbGllbnRZLG49QS5kb2MuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcHx8QS5kb2MuYm9keS5zY3JvbGxUb3AsYT1BLmRvYy5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdHx8QS5kb2MuYm9keS5zY3JvbGxMZWZ0LHMsbz1nZS5sZW5ndGg7by0tOyl7aWYocz1nZVtvXSxGJiZlLnRvdWNoZXMpe2Zvcih2YXIgbD1lLnRvdWNoZXMubGVuZ3RoLGg7bC0tOylpZihoPWUudG91Y2hlc1tsXSxoLmlkZW50aWZpZXI9PXMuZWwuX2RyYWcuaWQpe3I9aC5jbGllbnRYLGk9aC5jbGllbnRZLChlLm9yaWdpbmFsRXZlbnQ/ZS5vcmlnaW5hbEV2ZW50OmUpLnByZXZlbnREZWZhdWx0KCk7YnJlYWt9fWVsc2UgZS5wcmV2ZW50RGVmYXVsdCgpO3ZhciB1PXMuZWwubm9kZSxjLGY9dS5uZXh0U2libGluZyxwPXUucGFyZW50Tm9kZSxkPXUuc3R5bGUuZGlzcGxheTtBLndpbi5vcGVyYSYmcC5yZW1vdmVDaGlsZCh1KSx1LnN0eWxlLmRpc3BsYXk9XCJub25lXCIsYz1zLmVsLnBhcGVyLmdldEVsZW1lbnRCeVBvaW50KHIsaSksdS5zdHlsZS5kaXNwbGF5PWQsQS53aW4ub3BlcmEmJihmP3AuaW5zZXJ0QmVmb3JlKHUsZik6cC5hcHBlbmRDaGlsZCh1KSksYyYmdChcInJhcGhhZWwuZHJhZy5vdmVyLlwiK3MuZWwuaWQscy5lbCxjKSxyKz1hLGkrPW4sdChcInJhcGhhZWwuZHJhZy5tb3ZlLlwiK3MuZWwuaWQscy5tb3ZlX3Njb3BlfHxzLmVsLHItcy5lbC5fZHJhZy54LGktcy5lbC5fZHJhZy55LHIsaSxlKX19LHZlPWZ1bmN0aW9uKHIpe2UudW5tb3VzZW1vdmUoeGUpLnVubW91c2V1cCh2ZSk7Zm9yKHZhciBpPWdlLmxlbmd0aCxuO2ktLTspbj1nZVtpXSxuLmVsLl9kcmFnPXt9LHQoXCJyYXBoYWVsLmRyYWcuZW5kLlwiK24uZWwuaWQsbi5lbmRfc2NvcGV8fG4uc3RhcnRfc2NvcGV8fG4ubW92ZV9zY29wZXx8bi5lbCxyKTtnZT1bXX0seWU9ZS5lbD17fSxtZT1ELmxlbmd0aDttZS0tOykhZnVuY3Rpb24odCl7ZVt0XT15ZVt0XT1mdW5jdGlvbihyLGkpe3JldHVybiBlLmlzKHIsXCJmdW5jdGlvblwiKSYmKHRoaXMuZXZlbnRzPXRoaXMuZXZlbnRzfHxbXSx0aGlzLmV2ZW50cy5wdXNoKHtuYW1lOnQsZjpyLHVuYmluZDpkZSh0aGlzLnNoYXBlfHx0aGlzLm5vZGV8fEEuZG9jLHQscixpfHx0aGlzKX0pKSx0aGlzfSxlW1widW5cIit0XT15ZVtcInVuXCIrdF09ZnVuY3Rpb24ocil7Zm9yKHZhciBpPXRoaXMuZXZlbnRzfHxbXSxuPWkubGVuZ3RoO24tLTspaVtuXS5uYW1lIT10fHwhZS5pcyhyLFwidW5kZWZpbmVkXCIpJiZpW25dLmYhPXJ8fChpW25dLnVuYmluZCgpLGkuc3BsaWNlKG4sMSksIWkubGVuZ3RoJiZkZWxldGUgdGhpcy5ldmVudHMpO3JldHVybiB0aGlzfX0oRFttZV0pO3llLmRhdGE9ZnVuY3Rpb24ocixpKXt2YXIgbj13dFt0aGlzLmlkXT13dFt0aGlzLmlkXXx8e307aWYoMD09YXJndW1lbnRzLmxlbmd0aClyZXR1cm4gbjtpZigxPT1hcmd1bWVudHMubGVuZ3RoKXtpZihlLmlzKHIsXCJvYmplY3RcIikpe2Zvcih2YXIgYSBpbiByKXJbVF0oYSkmJnRoaXMuZGF0YShhLHJbYV0pO3JldHVybiB0aGlzfXJldHVybiB0KFwicmFwaGFlbC5kYXRhLmdldC5cIit0aGlzLmlkLHRoaXMsbltyXSxyKSxuW3JdfXJldHVybiBuW3JdPWksdChcInJhcGhhZWwuZGF0YS5zZXQuXCIrdGhpcy5pZCx0aGlzLGksciksdGhpc30seWUucmVtb3ZlRGF0YT1mdW5jdGlvbih0KXtyZXR1cm4gbnVsbD09dD93dFt0aGlzLmlkXT17fTp3dFt0aGlzLmlkXSYmZGVsZXRlIHd0W3RoaXMuaWRdW3RdLHRoaXN9LHllLmdldERhdGE9ZnVuY3Rpb24oKXtyZXR1cm4gcih3dFt0aGlzLmlkXXx8e30pfSx5ZS5ob3Zlcj1mdW5jdGlvbih0LGUscixpKXtyZXR1cm4gdGhpcy5tb3VzZW92ZXIodCxyKS5tb3VzZW91dChlLGl8fHIpfSx5ZS51bmhvdmVyPWZ1bmN0aW9uKHQsZSl7cmV0dXJuIHRoaXMudW5tb3VzZW92ZXIodCkudW5tb3VzZW91dChlKX07dmFyIGJlPVtdO3llLmRyYWc9ZnVuY3Rpb24ocixpLG4sYSxzLG8pe2Z1bmN0aW9uIGwobCl7KGwub3JpZ2luYWxFdmVudHx8bCkucHJldmVudERlZmF1bHQoKTt2YXIgaD1sLmNsaWVudFgsdT1sLmNsaWVudFksYz1BLmRvYy5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wfHxBLmRvYy5ib2R5LnNjcm9sbFRvcCxmPUEuZG9jLmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0fHxBLmRvYy5ib2R5LnNjcm9sbExlZnQ7aWYodGhpcy5fZHJhZy5pZD1sLmlkZW50aWZpZXIsRiYmbC50b3VjaGVzKWZvcih2YXIgcD1sLnRvdWNoZXMubGVuZ3RoLGQ7cC0tOylpZihkPWwudG91Y2hlc1twXSx0aGlzLl9kcmFnLmlkPWQuaWRlbnRpZmllcixkLmlkZW50aWZpZXI9PXRoaXMuX2RyYWcuaWQpe2g9ZC5jbGllbnRYLHU9ZC5jbGllbnRZO2JyZWFrfXRoaXMuX2RyYWcueD1oK2YsdGhpcy5fZHJhZy55PXUrYywhZ2UubGVuZ3RoJiZlLm1vdXNlbW92ZSh4ZSkubW91c2V1cCh2ZSksZ2UucHVzaCh7ZWw6dGhpcyxtb3ZlX3Njb3BlOmEsc3RhcnRfc2NvcGU6cyxlbmRfc2NvcGU6b30pLGkmJnQub24oXCJyYXBoYWVsLmRyYWcuc3RhcnQuXCIrdGhpcy5pZCxpKSxyJiZ0Lm9uKFwicmFwaGFlbC5kcmFnLm1vdmUuXCIrdGhpcy5pZCxyKSxuJiZ0Lm9uKFwicmFwaGFlbC5kcmFnLmVuZC5cIit0aGlzLmlkLG4pLHQoXCJyYXBoYWVsLmRyYWcuc3RhcnQuXCIrdGhpcy5pZCxzfHxhfHx0aGlzLGwuY2xpZW50WCtmLGwuY2xpZW50WStjLGwpfXJldHVybiB0aGlzLl9kcmFnPXt9LGJlLnB1c2goe2VsOnRoaXMsc3RhcnQ6bH0pLHRoaXMubW91c2Vkb3duKGwpLHRoaXN9LHllLm9uRHJhZ092ZXI9ZnVuY3Rpb24oZSl7ZT90Lm9uKFwicmFwaGFlbC5kcmFnLm92ZXIuXCIrdGhpcy5pZCxlKTp0LnVuYmluZChcInJhcGhhZWwuZHJhZy5vdmVyLlwiK3RoaXMuaWQpfSx5ZS51bmRyYWc9ZnVuY3Rpb24oKXtmb3IodmFyIHI9YmUubGVuZ3RoO3ItLTspYmVbcl0uZWw9PXRoaXMmJih0aGlzLnVubW91c2Vkb3duKGJlW3JdLnN0YXJ0KSxiZS5zcGxpY2UociwxKSx0LnVuYmluZChcInJhcGhhZWwuZHJhZy4qLlwiK3RoaXMuaWQpKTshYmUubGVuZ3RoJiZlLnVubW91c2Vtb3ZlKHhlKS51bm1vdXNldXAodmUpLGdlPVtdfSxNLmNpcmNsZT1mdW5jdGlvbih0LHIsaSl7dmFyIG49ZS5fZW5naW5lLmNpcmNsZSh0aGlzLHR8fDAscnx8MCxpfHwwKTtyZXR1cm4gdGhpcy5fX3NldF9fJiZ0aGlzLl9fc2V0X18ucHVzaChuKSxufSxNLnJlY3Q9ZnVuY3Rpb24odCxyLGksbixhKXt2YXIgcz1lLl9lbmdpbmUucmVjdCh0aGlzLHR8fDAscnx8MCxpfHwwLG58fDAsYXx8MCk7cmV0dXJuIHRoaXMuX19zZXRfXyYmdGhpcy5fX3NldF9fLnB1c2gocyksc30sTS5lbGxpcHNlPWZ1bmN0aW9uKHQscixpLG4pe3ZhciBhPWUuX2VuZ2luZS5lbGxpcHNlKHRoaXMsdHx8MCxyfHwwLGl8fDAsbnx8MCk7cmV0dXJuIHRoaXMuX19zZXRfXyYmdGhpcy5fX3NldF9fLnB1c2goYSksYX0sTS5wYXRoPWZ1bmN0aW9uKHQpe3QmJiFlLmlzKHQsWikmJiFlLmlzKHRbMF0sUSkmJih0Kz1SKTt2YXIgcj1lLl9lbmdpbmUucGF0aChlLmZvcm1hdFt6XShlLGFyZ3VtZW50cyksdGhpcyk7cmV0dXJuIHRoaXMuX19zZXRfXyYmdGhpcy5fX3NldF9fLnB1c2gocikscn0sTS5pbWFnZT1mdW5jdGlvbih0LHIsaSxuLGEpe3ZhciBzPWUuX2VuZ2luZS5pbWFnZSh0aGlzLHR8fFwiYWJvdXQ6YmxhbmtcIixyfHwwLGl8fDAsbnx8MCxhfHwwKTtyZXR1cm4gdGhpcy5fX3NldF9fJiZ0aGlzLl9fc2V0X18ucHVzaChzKSxzfSxNLnRleHQ9ZnVuY3Rpb24odCxyLGkpe3ZhciBuPWUuX2VuZ2luZS50ZXh0KHRoaXMsdHx8MCxyfHwwLGooaSkpO3JldHVybiB0aGlzLl9fc2V0X18mJnRoaXMuX19zZXRfXy5wdXNoKG4pLG59LE0uc2V0PWZ1bmN0aW9uKHQpeyFlLmlzKHQsXCJhcnJheVwiKSYmKHQ9QXJyYXkucHJvdG90eXBlLnNwbGljZS5jYWxsKGFyZ3VtZW50cywwLGFyZ3VtZW50cy5sZW5ndGgpKTt2YXIgcj1uZXcgemUodCk7cmV0dXJuIHRoaXMuX19zZXRfXyYmdGhpcy5fX3NldF9fLnB1c2gociksci5wYXBlcj10aGlzLHIudHlwZT1cInNldFwiLHJ9LE0uc2V0U3RhcnQ9ZnVuY3Rpb24odCl7dGhpcy5fX3NldF9fPXR8fHRoaXMuc2V0KCl9LE0uc2V0RmluaXNoPWZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMuX19zZXRfXztyZXR1cm4gZGVsZXRlIHRoaXMuX19zZXRfXyxlfSxNLmdldFNpemU9ZnVuY3Rpb24oKXt2YXIgdD10aGlzLmNhbnZhcy5wYXJlbnROb2RlO3JldHVybnt3aWR0aDp0Lm9mZnNldFdpZHRoLGhlaWdodDp0Lm9mZnNldEhlaWdodH19LE0uc2V0U2l6ZT1mdW5jdGlvbih0LHIpe3JldHVybiBlLl9lbmdpbmUuc2V0U2l6ZS5jYWxsKHRoaXMsdCxyKX0sTS5zZXRWaWV3Qm94PWZ1bmN0aW9uKHQscixpLG4sYSl7cmV0dXJuIGUuX2VuZ2luZS5zZXRWaWV3Qm94LmNhbGwodGhpcyx0LHIsaSxuLGEpfSxNLnRvcD1NLmJvdHRvbT1udWxsLE0ucmFwaGFlbD1lO3ZhciBfZT1mdW5jdGlvbih0KXt2YXIgZT10LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLHI9dC5vd25lckRvY3VtZW50LGk9ci5ib2R5LG49ci5kb2N1bWVudEVsZW1lbnQsYT1uLmNsaWVudFRvcHx8aS5jbGllbnRUb3B8fDAscz1uLmNsaWVudExlZnR8fGkuY2xpZW50TGVmdHx8MCxvPWUudG9wKyhBLndpbi5wYWdlWU9mZnNldHx8bi5zY3JvbGxUb3B8fGkuc2Nyb2xsVG9wKS1hLGw9ZS5sZWZ0KyhBLndpbi5wYWdlWE9mZnNldHx8bi5zY3JvbGxMZWZ0fHxpLnNjcm9sbExlZnQpLXM7cmV0dXJue3k6byx4Omx9fTtNLmdldEVsZW1lbnRCeVBvaW50PWZ1bmN0aW9uKHQsZSl7dmFyIHI9dGhpcyxpPXIuY2FudmFzLG49QS5kb2MuZWxlbWVudEZyb21Qb2ludCh0LGUpO2lmKEEud2luLm9wZXJhJiZcInN2Z1wiPT1uLnRhZ05hbWUpe3ZhciBhPV9lKGkpLHM9aS5jcmVhdGVTVkdSZWN0KCk7cy54PXQtYS54LHMueT1lLWEueSxzLndpZHRoPXMuaGVpZ2h0PTE7dmFyIG89aS5nZXRJbnRlcnNlY3Rpb25MaXN0KHMsbnVsbCk7by5sZW5ndGgmJihuPW9bby5sZW5ndGgtMV0pfWlmKCFuKXJldHVybiBudWxsO2Zvcig7bi5wYXJlbnROb2RlJiZuIT1pLnBhcmVudE5vZGUmJiFuLnJhcGhhZWw7KW49bi5wYXJlbnROb2RlO3JldHVybiBuPT1yLmNhbnZhcy5wYXJlbnROb2RlJiYobj1pKSxuPW4mJm4ucmFwaGFlbD9yLmdldEJ5SWQobi5yYXBoYWVsaWQpOm51bGx9LE0uZ2V0RWxlbWVudHNCeUJCb3g9ZnVuY3Rpb24odCl7dmFyIHI9dGhpcy5zZXQoKTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe2UuaXNCQm94SW50ZXJzZWN0KGkuZ2V0QkJveCgpLHQpJiZyLnB1c2goaSl9KSxyfSxNLmdldEJ5SWQ9ZnVuY3Rpb24odCl7Zm9yKHZhciBlPXRoaXMuYm90dG9tO2U7KXtpZihlLmlkPT10KXJldHVybiBlO2U9ZS5uZXh0fXJldHVybiBudWxsfSxNLmZvckVhY2g9ZnVuY3Rpb24odCxlKXtmb3IodmFyIHI9dGhpcy5ib3R0b207cjspe2lmKHQuY2FsbChlLHIpPT09ITEpcmV0dXJuIHRoaXM7cj1yLm5leHR9cmV0dXJuIHRoaXN9LE0uZ2V0RWxlbWVudHNCeVBvaW50PWZ1bmN0aW9uKHQsZSl7dmFyIHI9dGhpcy5zZXQoKTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe2kuaXNQb2ludEluc2lkZSh0LGUpJiZyLnB1c2goaSl9KSxyfSx5ZS5pc1BvaW50SW5zaWRlPWZ1bmN0aW9uKHQscil7dmFyIGk9dGhpcy5yZWFsUGF0aD1FdFt0aGlzLnR5cGVdKHRoaXMpO3JldHVybiB0aGlzLmF0dHIoXCJ0cmFuc2Zvcm1cIikmJnRoaXMuYXR0cihcInRyYW5zZm9ybVwiKS5sZW5ndGgmJihpPWUudHJhbnNmb3JtUGF0aChpLHRoaXMuYXR0cihcInRyYW5zZm9ybVwiKSkpLGUuaXNQb2ludEluc2lkZVBhdGgoaSx0LHIpfSx5ZS5nZXRCQm94PWZ1bmN0aW9uKHQpe2lmKHRoaXMucmVtb3ZlZClyZXR1cm57fTt2YXIgZT10aGlzLl87cmV0dXJuIHQ/KCFlLmRpcnR5JiZlLmJib3h3dHx8KHRoaXMucmVhbFBhdGg9RXRbdGhpcy50eXBlXSh0aGlzKSxlLmJib3h3dD1PdCh0aGlzLnJlYWxQYXRoKSxlLmJib3h3dC50b1N0cmluZz12LGUuZGlydHk9MCksZS5iYm94d3QpOigoZS5kaXJ0eXx8ZS5kaXJ0eVR8fCFlLmJib3gpJiYoIWUuZGlydHkmJnRoaXMucmVhbFBhdGh8fChlLmJib3h3dD0wLHRoaXMucmVhbFBhdGg9RXRbdGhpcy50eXBlXSh0aGlzKSksZS5iYm94PU90KE50KHRoaXMucmVhbFBhdGgsdGhpcy5tYXRyaXgpKSxlLmJib3gudG9TdHJpbmc9dixlLmRpcnR5PWUuZGlydHlUPTApLGUuYmJveCl9LHllLmNsb25lPWZ1bmN0aW9uKCl7aWYodGhpcy5yZW1vdmVkKXJldHVybiBudWxsO3ZhciB0PXRoaXMucGFwZXJbdGhpcy50eXBlXSgpLmF0dHIodGhpcy5hdHRyKCkpO3JldHVybiB0aGlzLl9fc2V0X18mJnRoaXMuX19zZXRfXy5wdXNoKHQpLHR9LHllLmdsb3c9ZnVuY3Rpb24odCl7aWYoXCJ0ZXh0XCI9PXRoaXMudHlwZSlyZXR1cm4gbnVsbDt0PXR8fHt9O3ZhciBlPXt3aWR0aDoodC53aWR0aHx8MTApKygrdGhpcy5hdHRyKFwic3Ryb2tlLXdpZHRoXCIpfHwxKSxmaWxsOnQuZmlsbHx8ITEsb3BhY2l0eTpudWxsPT10Lm9wYWNpdHk/LjU6dC5vcGFjaXR5LG9mZnNldHg6dC5vZmZzZXR4fHwwLG9mZnNldHk6dC5vZmZzZXR5fHwwLGNvbG9yOnQuY29sb3J8fFwiIzAwMFwifSxyPWUud2lkdGgvMixpPXRoaXMucGFwZXIsbj1pLnNldCgpLGE9dGhpcy5yZWFsUGF0aHx8RXRbdGhpcy50eXBlXSh0aGlzKTthPXRoaXMubWF0cml4P050KGEsdGhpcy5tYXRyaXgpOmE7Zm9yKHZhciBzPTE7cisxPnM7cysrKW4ucHVzaChpLnBhdGgoYSkuYXR0cih7c3Ryb2tlOmUuY29sb3IsZmlsbDplLmZpbGw/ZS5jb2xvcjpcIm5vbmVcIixcInN0cm9rZS1saW5lam9pblwiOlwicm91bmRcIixcInN0cm9rZS1saW5lY2FwXCI6XCJyb3VuZFwiLFwic3Ryb2tlLXdpZHRoXCI6KyhlLndpZHRoL3IqcykudG9GaXhlZCgzKSxvcGFjaXR5OisoZS5vcGFjaXR5L3IpLnRvRml4ZWQoMyl9KSk7cmV0dXJuIG4uaW5zZXJ0QmVmb3JlKHRoaXMpLnRyYW5zbGF0ZShlLm9mZnNldHgsZS5vZmZzZXR5KX07dmFyIHdlPXt9LGtlPWZ1bmN0aW9uKHQscixpLG4sYSxzLG8sdSxjKXtyZXR1cm4gbnVsbD09Yz9sKHQscixpLG4sYSxzLG8sdSk6ZS5maW5kRG90c0F0U2VnbWVudCh0LHIsaSxuLGEscyxvLHUsaCh0LHIsaSxuLGEscyxvLHUsYykpfSxCZT1mdW5jdGlvbih0LHIpe3JldHVybiBmdW5jdGlvbihpLG4sYSl7aT1RdChpKTtmb3IodmFyIHMsbyxsLGgsdT1cIlwiLGM9e30sZixwPTAsZD0wLGc9aS5sZW5ndGg7Zz5kO2QrKyl7aWYobD1pW2RdLFwiTVwiPT1sWzBdKXM9K2xbMV0sbz0rbFsyXTtlbHNle2lmKGg9a2UocyxvLGxbMV0sbFsyXSxsWzNdLGxbNF0sbFs1XSxsWzZdKSxwK2g+bil7aWYociYmIWMuc3RhcnQpe2lmKGY9a2UocyxvLGxbMV0sbFsyXSxsWzNdLGxbNF0sbFs1XSxsWzZdLG4tcCksdSs9W1wiQ1wiK2Yuc3RhcnQueCxmLnN0YXJ0LnksZi5tLngsZi5tLnksZi54LGYueV0sYSlyZXR1cm4gdTtjLnN0YXJ0PXUsdT1bXCJNXCIrZi54LGYueStcIkNcIitmLm4ueCxmLm4ueSxmLmVuZC54LGYuZW5kLnksbFs1XSxsWzZdXS5qb2luKCkscCs9aCxzPStsWzVdLG89K2xbNl07Y29udGludWV9aWYoIXQmJiFyKXJldHVybiBmPWtlKHMsbyxsWzFdLGxbMl0sbFszXSxsWzRdLGxbNV0sbFs2XSxuLXApLHt4OmYueCx5OmYueSxhbHBoYTpmLmFscGhhfX1wKz1oLHM9K2xbNV0sbz0rbFs2XX11Kz1sLnNoaWZ0KCkrbH1yZXR1cm4gYy5lbmQ9dSxmPXQ/cDpyP2M6ZS5maW5kRG90c0F0U2VnbWVudChzLG8sbFswXSxsWzFdLGxbMl0sbFszXSxsWzRdLGxbNV0sMSksZi5hbHBoYSYmKGY9e3g6Zi54LHk6Zi55LGFscGhhOmYuYWxwaGF9KSxmfX0sQ2U9QmUoMSksU2U9QmUoKSxUZT1CZSgwLDEpO2UuZ2V0VG90YWxMZW5ndGg9Q2UsZS5nZXRQb2ludEF0TGVuZ3RoPVNlLGUuZ2V0U3VicGF0aD1mdW5jdGlvbih0LGUscil7aWYodGhpcy5nZXRUb3RhbExlbmd0aCh0KS1yPDFlLTYpcmV0dXJuIFRlKHQsZSkuZW5kO3ZhciBpPVRlKHQsciwxKTtyZXR1cm4gZT9UZShpLGUpLmVuZDppfSx5ZS5nZXRUb3RhbExlbmd0aD1mdW5jdGlvbigpe3ZhciB0PXRoaXMuZ2V0UGF0aCgpO2lmKHQpcmV0dXJuIHRoaXMubm9kZS5nZXRUb3RhbExlbmd0aD90aGlzLm5vZGUuZ2V0VG90YWxMZW5ndGgoKTpDZSh0KX0seWUuZ2V0UG9pbnRBdExlbmd0aD1mdW5jdGlvbih0KXt2YXIgZT10aGlzLmdldFBhdGgoKTtpZihlKXJldHVybiBTZShlLHQpfSx5ZS5nZXRQYXRoPWZ1bmN0aW9uKCl7dmFyIHQscj1lLl9nZXRQYXRoW3RoaXMudHlwZV07aWYoXCJ0ZXh0XCIhPXRoaXMudHlwZSYmXCJzZXRcIiE9dGhpcy50eXBlKXJldHVybiByJiYodD1yKHRoaXMpKSx0fSx5ZS5nZXRTdWJwYXRoPWZ1bmN0aW9uKHQscil7dmFyIGk9dGhpcy5nZXRQYXRoKCk7aWYoaSlyZXR1cm4gZS5nZXRTdWJwYXRoKGksdCxyKX07dmFyIEFlPWUuZWFzaW5nX2Zvcm11bGFzPXtsaW5lYXI6ZnVuY3Rpb24odCl7cmV0dXJuIHR9LFwiPFwiOmZ1bmN0aW9uKHQpe3JldHVybiBYKHQsMS43KX0sXCI+XCI6ZnVuY3Rpb24odCl7cmV0dXJuIFgodCwuNDgpfSxcIjw+XCI6ZnVuY3Rpb24odCl7dmFyIGU9LjQ4LXQvMS4wNCxyPVkuc3FydCguMTczNCtlKmUpLGk9ci1lLG49WChIKGkpLDEvMykqKDA+aT8tMToxKSxhPS1yLWUscz1YKEgoYSksMS8zKSooMD5hPy0xOjEpLG89bitzKy41O3JldHVybiAzKigxLW8pKm8qbytvKm8qb30sYmFja0luOmZ1bmN0aW9uKHQpe3ZhciBlPTEuNzAxNTg7cmV0dXJuIHQqdCooKGUrMSkqdC1lKX0sYmFja091dDpmdW5jdGlvbih0KXt0LT0xO3ZhciBlPTEuNzAxNTg7cmV0dXJuIHQqdCooKGUrMSkqdCtlKSsxfSxlbGFzdGljOmZ1bmN0aW9uKHQpe3JldHVybiB0PT0hIXQ/dDpYKDIsLTEwKnQpKlkuc2luKCh0LS4wNzUpKigyKlUpLy4zKSsxfSxib3VuY2U6ZnVuY3Rpb24odCl7dmFyIGU9Ny41NjI1LHI9Mi43NSxpO3JldHVybiAxL3I+dD9pPWUqdCp0OjIvcj50Pyh0LT0xLjUvcixpPWUqdCp0Ky43NSk6Mi41L3I+dD8odC09Mi4yNS9yLGk9ZSp0KnQrLjkzNzUpOih0LT0yLjYyNS9yLGk9ZSp0KnQrLjk4NDM3NSksaX19O0FlLmVhc2VJbj1BZVtcImVhc2UtaW5cIl09QWVbXCI8XCJdLEFlLmVhc2VPdXQ9QWVbXCJlYXNlLW91dFwiXT1BZVtcIj5cIl0sQWUuZWFzZUluT3V0PUFlW1wiZWFzZS1pbi1vdXRcIl09QWVbXCI8PlwiXSxBZVtcImJhY2staW5cIl09QWUuYmFja0luLEFlW1wiYmFjay1vdXRcIl09QWUuYmFja091dDt2YXIgRWU9W10sTmU9d2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZXx8d2luZG93LndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZXx8d2luZG93Lm1velJlcXVlc3RBbmltYXRpb25GcmFtZXx8d2luZG93Lm9SZXF1ZXN0QW5pbWF0aW9uRnJhbWV8fHdpbmRvdy5tc1JlcXVlc3RBbmltYXRpb25GcmFtZXx8ZnVuY3Rpb24odCl7c2V0VGltZW91dCh0LDE2KX0sTWU9ZnVuY3Rpb24oKXtmb3IodmFyIHI9K25ldyBEYXRlLGk9MDtpPEVlLmxlbmd0aDtpKyspe3ZhciBuPUVlW2ldO2lmKCFuLmVsLnJlbW92ZWQmJiFuLnBhdXNlZCl7dmFyIGE9ci1uLnN0YXJ0LHM9bi5tcyxvPW4uZWFzaW5nLGw9bi5mcm9tLGg9bi5kaWZmLHU9bi50byxjPW4udCxmPW4uZWwscD17fSxkLGc9e30seDtpZihuLmluaXRzdGF0dXM/KGE9KG4uaW5pdHN0YXR1cypuLmFuaW0udG9wLW4ucHJldikvKG4ucGVyY2VudC1uLnByZXYpKnMsbi5zdGF0dXM9bi5pbml0c3RhdHVzLGRlbGV0ZSBuLmluaXRzdGF0dXMsbi5zdG9wJiZFZS5zcGxpY2UoaS0tLDEpKTpuLnN0YXR1cz0obi5wcmV2KyhuLnBlcmNlbnQtbi5wcmV2KSooYS9zKSkvbi5hbmltLnRvcCwhKDA+YSkpaWYocz5hKXt2YXIgdj1vKGEvcyk7Zm9yKHZhciB5IGluIGwpaWYobFtUXSh5KSl7c3dpdGNoKHB0W3ldKXtjYXNlICQ6ZD0rbFt5XSt2KnMqaFt5XTticmVhaztjYXNlXCJjb2xvdXJcIjpkPVwicmdiKFwiK1tMZShvdChsW3ldLnIrdipzKmhbeV0ucikpLExlKG90KGxbeV0uZyt2KnMqaFt5XS5nKSksTGUob3QobFt5XS5iK3YqcypoW3ldLmIpKV0uam9pbihcIixcIikrXCIpXCI7YnJlYWs7Y2FzZVwicGF0aFwiOmQ9W107Zm9yKHZhciBtPTAsXz1sW3ldLmxlbmd0aDtfPm07bSsrKXtkW21dPVtsW3ldW21dWzBdXTtmb3IodmFyIHc9MSxrPWxbeV1bbV0ubGVuZ3RoO2s+dzt3KyspZFttXVt3XT0rbFt5XVttXVt3XSt2KnMqaFt5XVttXVt3XTtkW21dPWRbbV0uam9pbihJKX1kPWQuam9pbihJKTticmVhaztjYXNlXCJ0cmFuc2Zvcm1cIjppZihoW3ldLnJlYWwpZm9yKGQ9W10sbT0wLF89bFt5XS5sZW5ndGg7Xz5tO20rKylmb3IoZFttXT1bbFt5XVttXVswXV0sdz0xLGs9bFt5XVttXS5sZW5ndGg7az53O3crKylkW21dW3ddPWxbeV1bbV1bd10rdipzKmhbeV1bbV1bd107ZWxzZXt2YXIgQj1mdW5jdGlvbih0KXtyZXR1cm4rbFt5XVt0XSt2KnMqaFt5XVt0XX07ZD1bW1wibVwiLEIoMCksQigxKSxCKDIpLEIoMyksQig0KSxCKDUpXV19YnJlYWs7Y2FzZVwiY3N2XCI6aWYoXCJjbGlwLXJlY3RcIj09eSlmb3IoZD1bXSxtPTQ7bS0tOylkW21dPStsW3ldW21dK3YqcypoW3ldW21dO2JyZWFrO2RlZmF1bHQ6dmFyIEM9W11bUF0obFt5XSk7Zm9yKGQ9W10sbT1mLnBhcGVyLmN1c3RvbUF0dHJpYnV0ZXNbeV0ubGVuZ3RoO20tLTspZFttXT0rQ1ttXSt2KnMqaFt5XVttXX1wW3ldPWR9Zi5hdHRyKHApLGZ1bmN0aW9uKGUscixpKXtzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7dChcInJhcGhhZWwuYW5pbS5mcmFtZS5cIitlLHIsaSl9KX0oZi5pZCxmLG4uYW5pbSl9ZWxzZXtpZihmdW5jdGlvbihyLGksbil7c2V0VGltZW91dChmdW5jdGlvbigpe3QoXCJyYXBoYWVsLmFuaW0uZnJhbWUuXCIraS5pZCxpLG4pLHQoXCJyYXBoYWVsLmFuaW0uZmluaXNoLlwiK2kuaWQsaSxuKSxlLmlzKHIsXCJmdW5jdGlvblwiKSYmci5jYWxsKGkpfSl9KG4uY2FsbGJhY2ssZixuLmFuaW0pLGYuYXR0cih1KSxFZS5zcGxpY2UoaS0tLDEpLG4ucmVwZWF0PjEmJiFuLm5leHQpe2Zvcih4IGluIHUpdVtUXSh4KSYmKGdbeF09bi50b3RhbE9yaWdpblt4XSk7bi5lbC5hdHRyKGcpLGIobi5hbmltLG4uZWwsbi5hbmltLnBlcmNlbnRzWzBdLG51bGwsbi50b3RhbE9yaWdpbixuLnJlcGVhdC0xKX1uLm5leHQmJiFuLnN0b3AmJmIobi5hbmltLG4uZWwsbi5uZXh0LG51bGwsbi50b3RhbE9yaWdpbixuLnJlcGVhdCl9fX1FZS5sZW5ndGgmJk5lKE1lKX0sTGU9ZnVuY3Rpb24odCl7cmV0dXJuIHQ+MjU1PzI1NTowPnQ/MDp0fTt5ZS5hbmltYXRlV2l0aD1mdW5jdGlvbih0LHIsaSxuLGEscyl7dmFyIG89dGhpcztpZihvLnJlbW92ZWQpcmV0dXJuIHMmJnMuY2FsbChvKSxvO3ZhciBsPWkgaW5zdGFuY2VvZiBtP2k6ZS5hbmltYXRpb24oaSxuLGEscyksaCx1O2IobCxvLGwucGVyY2VudHNbMF0sbnVsbCxvLmF0dHIoKSk7Zm9yKHZhciBjPTAsZj1FZS5sZW5ndGg7Zj5jO2MrKylpZihFZVtjXS5hbmltPT1yJiZFZVtjXS5lbD09dCl7RWVbZi0xXS5zdGFydD1FZVtjXS5zdGFydDticmVha31yZXR1cm4gb30seWUub25BbmltYXRpb249ZnVuY3Rpb24oZSl7cmV0dXJuIGU/dC5vbihcInJhcGhhZWwuYW5pbS5mcmFtZS5cIit0aGlzLmlkLGUpOnQudW5iaW5kKFwicmFwaGFlbC5hbmltLmZyYW1lLlwiK3RoaXMuaWQpLHRoaXN9LG0ucHJvdG90eXBlLmRlbGF5PWZ1bmN0aW9uKHQpe3ZhciBlPW5ldyBtKHRoaXMuYW5pbSx0aGlzLm1zKTtyZXR1cm4gZS50aW1lcz10aGlzLnRpbWVzLGUuZGVsPSt0fHwwLGV9LG0ucHJvdG90eXBlLnJlcGVhdD1mdW5jdGlvbih0KXt2YXIgZT1uZXcgbSh0aGlzLmFuaW0sdGhpcy5tcyk7cmV0dXJuIGUuZGVsPXRoaXMuZGVsLGUudGltZXM9WS5mbG9vcihXKHQsMCkpfHwxLGV9LGUuYW5pbWF0aW9uPWZ1bmN0aW9uKHQscixpLG4pe2lmKHQgaW5zdGFuY2VvZiBtKXJldHVybiB0OyFlLmlzKGksXCJmdW5jdGlvblwiKSYmaXx8KG49bnx8aXx8bnVsbCxpPW51bGwpLHQ9T2JqZWN0KHQpLHI9K3J8fDA7dmFyIGE9e30scyxvO2ZvcihvIGluIHQpdFtUXShvKSYmaHQobykhPW8mJmh0KG8pK1wiJVwiIT1vJiYocz0hMCxhW29dPXRbb10pO2lmKHMpcmV0dXJuIGkmJihhLmVhc2luZz1pKSxuJiYoYS5jYWxsYmFjaz1uKSxuZXcgbSh7MTAwOmF9LHIpO2lmKG4pe3ZhciBsPTA7Zm9yKHZhciBoIGluIHQpe3ZhciB1PXV0KGgpO3RbVF0oaCkmJnU+bCYmKGw9dSl9bCs9XCIlXCIsIXRbbF0uY2FsbGJhY2smJih0W2xdLmNhbGxiYWNrPW4pfXJldHVybiBuZXcgbSh0LHIpfSx5ZS5hbmltYXRlPWZ1bmN0aW9uKHQscixpLG4pe3ZhciBhPXRoaXM7aWYoYS5yZW1vdmVkKXJldHVybiBuJiZuLmNhbGwoYSksYTt2YXIgcz10IGluc3RhbmNlb2YgbT90OmUuYW5pbWF0aW9uKHQscixpLG4pO3JldHVybiBiKHMsYSxzLnBlcmNlbnRzWzBdLG51bGwsYS5hdHRyKCkpLGF9LHllLnNldFRpbWU9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdCYmbnVsbCE9ZSYmdGhpcy5zdGF0dXModCxHKGUsdC5tcykvdC5tcyksdGhpc30seWUuc3RhdHVzPWZ1bmN0aW9uKHQsZSl7dmFyIHI9W10saT0wLG4sYTtpZihudWxsIT1lKXJldHVybiBiKHQsdGhpcywtMSxHKGUsMSkpLHRoaXM7Zm9yKG49RWUubGVuZ3RoO24+aTtpKyspaWYoYT1FZVtpXSxhLmVsLmlkPT10aGlzLmlkJiYoIXR8fGEuYW5pbT09dCkpe2lmKHQpcmV0dXJuIGEuc3RhdHVzO3IucHVzaCh7YW5pbTphLmFuaW0sc3RhdHVzOmEuc3RhdHVzfSl9cmV0dXJuIHQ/MDpyfSx5ZS5wYXVzZT1mdW5jdGlvbihlKXtmb3IodmFyIHI9MDtyPEVlLmxlbmd0aDtyKyspRWVbcl0uZWwuaWQhPXRoaXMuaWR8fGUmJkVlW3JdLmFuaW0hPWV8fHQoXCJyYXBoYWVsLmFuaW0ucGF1c2UuXCIrdGhpcy5pZCx0aGlzLEVlW3JdLmFuaW0pIT09ITEmJihFZVtyXS5wYXVzZWQ9ITApO3JldHVybiB0aGlzfSx5ZS5yZXN1bWU9ZnVuY3Rpb24oZSl7Zm9yKHZhciByPTA7cjxFZS5sZW5ndGg7cisrKWlmKEVlW3JdLmVsLmlkPT10aGlzLmlkJiYoIWV8fEVlW3JdLmFuaW09PWUpKXt2YXIgaT1FZVtyXTt0KFwicmFwaGFlbC5hbmltLnJlc3VtZS5cIit0aGlzLmlkLHRoaXMsaS5hbmltKSE9PSExJiYoZGVsZXRlIGkucGF1c2VkLHRoaXMuc3RhdHVzKGkuYW5pbSxpLnN0YXR1cykpfXJldHVybiB0aGlzfSx5ZS5zdG9wPWZ1bmN0aW9uKGUpe2Zvcih2YXIgcj0wO3I8RWUubGVuZ3RoO3IrKylFZVtyXS5lbC5pZCE9dGhpcy5pZHx8ZSYmRWVbcl0uYW5pbSE9ZXx8dChcInJhcGhhZWwuYW5pbS5zdG9wLlwiK3RoaXMuaWQsdGhpcyxFZVtyXS5hbmltKSE9PSExJiZFZS5zcGxpY2Uoci0tLDEpO3JldHVybiB0aGlzfSx0Lm9uKFwicmFwaGFlbC5yZW1vdmVcIixfKSx0Lm9uKFwicmFwaGFlbC5jbGVhclwiLF8pLHllLnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJSYXBoYcOrbOKAmXMgb2JqZWN0XCJ9O3ZhciB6ZT1mdW5jdGlvbih0KXtpZih0aGlzLml0ZW1zPVtdLHRoaXMubGVuZ3RoPTAsdGhpcy50eXBlPVwic2V0XCIsdClmb3IodmFyIGU9MCxyPXQubGVuZ3RoO3I+ZTtlKyspIXRbZV18fHRbZV0uY29uc3RydWN0b3IhPXllLmNvbnN0cnVjdG9yJiZ0W2VdLmNvbnN0cnVjdG9yIT16ZXx8KHRoaXNbdGhpcy5pdGVtcy5sZW5ndGhdPXRoaXMuaXRlbXNbdGhpcy5pdGVtcy5sZW5ndGhdPXRbZV0sdGhpcy5sZW5ndGgrKyl9LFBlPXplLnByb3RvdHlwZTtQZS5wdXNoPWZ1bmN0aW9uKCl7Zm9yKHZhciB0LGUscj0wLGk9YXJndW1lbnRzLmxlbmd0aDtpPnI7cisrKXQ9YXJndW1lbnRzW3JdLCF0fHx0LmNvbnN0cnVjdG9yIT15ZS5jb25zdHJ1Y3RvciYmdC5jb25zdHJ1Y3RvciE9emV8fChlPXRoaXMuaXRlbXMubGVuZ3RoLHRoaXNbZV09dGhpcy5pdGVtc1tlXT10LHRoaXMubGVuZ3RoKyspO3JldHVybiB0aGlzfSxQZS5wb3A9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5sZW5ndGgmJmRlbGV0ZSB0aGlzW3RoaXMubGVuZ3RoLS1dLHRoaXMuaXRlbXMucG9wKCl9LFBlLmZvckVhY2g9ZnVuY3Rpb24odCxlKXtmb3IodmFyIHI9MCxpPXRoaXMuaXRlbXMubGVuZ3RoO2k+cjtyKyspaWYodC5jYWxsKGUsdGhpcy5pdGVtc1tyXSxyKT09PSExKXJldHVybiB0aGlzO3JldHVybiB0aGlzfTtmb3IodmFyIEZlIGluIHllKXllW1RdKEZlKSYmKFBlW0ZlXT1mdW5jdGlvbih0KXtyZXR1cm4gZnVuY3Rpb24oKXt2YXIgZT1hcmd1bWVudHM7cmV0dXJuIHRoaXMuZm9yRWFjaChmdW5jdGlvbihyKXtyW3RdW3pdKHIsZSl9KX19KEZlKSk7cmV0dXJuIFBlLmF0dHI9ZnVuY3Rpb24odCxyKXtpZih0JiZlLmlzKHQsUSkmJmUuaXModFswXSxcIm9iamVjdFwiKSlmb3IodmFyIGk9MCxuPXQubGVuZ3RoO24+aTtpKyspdGhpcy5pdGVtc1tpXS5hdHRyKHRbaV0pO2Vsc2UgZm9yKHZhciBhPTAscz10aGlzLml0ZW1zLmxlbmd0aDtzPmE7YSsrKXRoaXMuaXRlbXNbYV0uYXR0cih0LHIpO3JldHVybiB0aGlzfSxQZS5jbGVhcj1mdW5jdGlvbigpe2Zvcig7dGhpcy5sZW5ndGg7KXRoaXMucG9wKCl9LFBlLnNwbGljZT1mdW5jdGlvbih0LGUscil7dD0wPnQ/Vyh0aGlzLmxlbmd0aCt0LDApOnQsZT1XKDAsRyh0aGlzLmxlbmd0aC10LGUpKTt2YXIgaT1bXSxuPVtdLGE9W10scztmb3Iocz0yO3M8YXJndW1lbnRzLmxlbmd0aDtzKyspYS5wdXNoKGFyZ3VtZW50c1tzXSk7Zm9yKHM9MDtlPnM7cysrKW4ucHVzaCh0aGlzW3Qrc10pO2Zvcig7czx0aGlzLmxlbmd0aC10O3MrKylpLnB1c2godGhpc1t0K3NdKTt2YXIgbz1hLmxlbmd0aDtmb3Iocz0wO3M8bytpLmxlbmd0aDtzKyspdGhpcy5pdGVtc1t0K3NdPXRoaXNbdCtzXT1vPnM/YVtzXTppW3Mtb107Zm9yKHM9dGhpcy5pdGVtcy5sZW5ndGg9dGhpcy5sZW5ndGgtPWUtbzt0aGlzW3NdOylkZWxldGUgdGhpc1tzKytdO3JldHVybiBuZXcgemUobil9LFBlLmV4Y2x1ZGU9ZnVuY3Rpb24odCl7Zm9yKHZhciBlPTAscj10aGlzLmxlbmd0aDtyPmU7ZSsrKWlmKHRoaXNbZV09PXQpcmV0dXJuIHRoaXMuc3BsaWNlKGUsMSksITB9LFBlLmFuaW1hdGU9ZnVuY3Rpb24odCxyLGksbil7KGUuaXMoaSxcImZ1bmN0aW9uXCIpfHwhaSkmJihuPWl8fG51bGwpO3ZhciBhPXRoaXMuaXRlbXMubGVuZ3RoLHM9YSxvLGw9dGhpcyxoO2lmKCFhKXJldHVybiB0aGlzO24mJihoPWZ1bmN0aW9uKCl7IS0tYSYmbi5jYWxsKGwpfSksaT1lLmlzKGksWik/aTpoO3ZhciB1PWUuYW5pbWF0aW9uKHQscixpLGgpO2ZvcihvPXRoaXMuaXRlbXNbLS1zXS5hbmltYXRlKHUpO3MtLTspdGhpcy5pdGVtc1tzXSYmIXRoaXMuaXRlbXNbc10ucmVtb3ZlZCYmdGhpcy5pdGVtc1tzXS5hbmltYXRlV2l0aChvLHUsdSksdGhpcy5pdGVtc1tzXSYmIXRoaXMuaXRlbXNbc10ucmVtb3ZlZHx8YS0tO3JldHVybiB0aGlzfSxQZS5pbnNlcnRBZnRlcj1mdW5jdGlvbih0KXtmb3IodmFyIGU9dGhpcy5pdGVtcy5sZW5ndGg7ZS0tOyl0aGlzLml0ZW1zW2VdLmluc2VydEFmdGVyKHQpO3JldHVybiB0aGlzfSxQZS5nZXRCQm94PWZ1bmN0aW9uKCl7Zm9yKHZhciB0PVtdLGU9W10scj1bXSxpPVtdLG49dGhpcy5pdGVtcy5sZW5ndGg7bi0tOylpZighdGhpcy5pdGVtc1tuXS5yZW1vdmVkKXt2YXIgYT10aGlzLml0ZW1zW25dLmdldEJCb3goKTt0LnB1c2goYS54KSxlLnB1c2goYS55KSxyLnB1c2goYS54K2Eud2lkdGgpLGkucHVzaChhLnkrYS5oZWlnaHQpfXJldHVybiB0PUdbel0oMCx0KSxlPUdbel0oMCxlKSxyPVdbel0oMCxyKSxpPVdbel0oMCxpKSx7eDp0LHk6ZSx4MjpyLHkyOmksd2lkdGg6ci10LGhlaWdodDppLWV9fSxQZS5jbG9uZT1mdW5jdGlvbih0KXt0PXRoaXMucGFwZXIuc2V0KCk7Zm9yKHZhciBlPTAscj10aGlzLml0ZW1zLmxlbmd0aDtyPmU7ZSsrKXQucHVzaCh0aGlzLml0ZW1zW2VdLmNsb25lKCkpO3JldHVybiB0fSxQZS50b1N0cmluZz1mdW5jdGlvbigpe3JldHVyblwiUmFwaGHDq2zigJhzIHNldFwifSxQZS5nbG93PWZ1bmN0aW9uKHQpe3ZhciBlPXRoaXMucGFwZXIuc2V0KCk7cmV0dXJuIHRoaXMuZm9yRWFjaChmdW5jdGlvbihyLGkpe3ZhciBuPXIuZ2xvdyh0KTtudWxsIT1uJiZuLmZvckVhY2goZnVuY3Rpb24odCxyKXtlLnB1c2godCl9KX0pLGV9LFBlLmlzUG9pbnRJbnNpZGU9ZnVuY3Rpb24odCxlKXt2YXIgcj0hMTtyZXR1cm4gdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKGkpe3JldHVybiBpLmlzUG9pbnRJbnNpZGUodCxlKT8ocj0hMCwhMSk6dm9pZCAwfSkscn0sZS5yZWdpc3RlckZvbnQ9ZnVuY3Rpb24odCl7aWYoIXQuZmFjZSlyZXR1cm4gdDt0aGlzLmZvbnRzPXRoaXMuZm9udHN8fHt9O3ZhciBlPXt3OnQudyxmYWNlOnt9LGdseXBoczp7fX0scj10LmZhY2VbXCJmb250LWZhbWlseVwiXTtmb3IodmFyIGkgaW4gdC5mYWNlKXQuZmFjZVtUXShpKSYmKGUuZmFjZVtpXT10LmZhY2VbaV0pO2lmKHRoaXMuZm9udHNbcl0/dGhpcy5mb250c1tyXS5wdXNoKGUpOnRoaXMuZm9udHNbcl09W2VdLCF0LnN2Zyl7ZS5mYWNlW1widW5pdHMtcGVyLWVtXCJdPXV0KHQuZmFjZVtcInVuaXRzLXBlci1lbVwiXSwxMCk7Zm9yKHZhciBuIGluIHQuZ2x5cGhzKWlmKHQuZ2x5cGhzW1RdKG4pKXt2YXIgYT10LmdseXBoc1tuXTtpZihlLmdseXBoc1tuXT17dzphLncsazp7fSxkOmEuZCYmXCJNXCIrYS5kLnJlcGxhY2UoL1ttbGN4dHJ2XS9nLGZ1bmN0aW9uKHQpe3JldHVybntsOlwiTFwiLGM6XCJDXCIseDpcInpcIix0OlwibVwiLHI6XCJsXCIsdjpcImNcIn1bdF18fFwiTVwifSkrXCJ6XCJ9LGEuaylmb3IodmFyIHMgaW4gYS5rKWFbVF0ocykmJihlLmdseXBoc1tuXS5rW3NdPWEua1tzXSl9fXJldHVybiB0fSxNLmdldEZvbnQ9ZnVuY3Rpb24odCxyLGksbil7aWYobj1ufHxcIm5vcm1hbFwiLGk9aXx8XCJub3JtYWxcIixyPStyfHx7bm9ybWFsOjQwMCxib2xkOjcwMCxsaWdodGVyOjMwMCxib2xkZXI6ODAwfVtyXXx8NDAwLGUuZm9udHMpe3ZhciBhPWUuZm9udHNbdF07aWYoIWEpe3ZhciBzPW5ldyBSZWdFeHAoXCIoXnxcXFxccylcIit0LnJlcGxhY2UoL1teXFx3XFxkXFxzKyF+LjpfLV0vZyxSKStcIihcXFxcc3wkKVwiLFwiaVwiKTtmb3IodmFyIG8gaW4gZS5mb250cylpZihlLmZvbnRzW1RdKG8pJiZzLnRlc3Qobykpe2E9ZS5mb250c1tvXTticmVha319dmFyIGw7aWYoYSlmb3IodmFyIGg9MCx1PWEubGVuZ3RoO3U+aCYmKGw9YVtoXSxsLmZhY2VbXCJmb250LXdlaWdodFwiXSE9cnx8bC5mYWNlW1wiZm9udC1zdHlsZVwiXSE9aSYmbC5mYWNlW1wiZm9udC1zdHlsZVwiXXx8bC5mYWNlW1wiZm9udC1zdHJldGNoXCJdIT1uKTtoKyspO3JldHVybiBsfX0sTS5wcmludD1mdW5jdGlvbih0LHIsaSxuLGEscyxvLGwpe3M9c3x8XCJtaWRkbGVcIixvPVcoRyhvfHwwLDEpLC0xKSxsPVcoRyhsfHwxLDMpLDEpO3ZhciBoPWooaSlbcV0oUiksdT0wLGM9MCxmPVIscDtpZihlLmlzKG4sXCJzdHJpbmdcIikmJihuPXRoaXMuZ2V0Rm9udChuKSksbil7cD0oYXx8MTYpL24uZmFjZVtcInVuaXRzLXBlci1lbVwiXTtmb3IodmFyIGQ9bi5mYWNlLmJib3hbcV0oayksZz0rZFswXSx4PWRbM10tZFsxXSx2PTAseT0rZFsxXSsoXCJiYXNlbGluZVwiPT1zP3grICtuLmZhY2UuZGVzY2VudDp4LzIpLG09MCxiPWgubGVuZ3RoO2I+bTttKyspe2lmKFwiXFxuXCI9PWhbbV0pdT0wLHc9MCxjPTAsdis9eCpsO2Vsc2V7dmFyIF89YyYmbi5nbHlwaHNbaFttLTFdXXx8e30sdz1uLmdseXBoc1toW21dXTt1Kz1jPyhfLnd8fG4udykrKF8uayYmXy5rW2hbbV1dfHwwKStuLncqbzowLGM9MX13JiZ3LmQmJihmKz1lLnRyYW5zZm9ybVBhdGgody5kLFtcInRcIix1KnAsdipwLFwic1wiLHAscCxnLHksXCJ0XCIsKHQtZykvcCwoci15KS9wXSkpfX1yZXR1cm4gdGhpcy5wYXRoKGYpLmF0dHIoe2ZpbGw6XCIjMDAwXCIsc3Ryb2tlOlwibm9uZVwifSl9LE0uYWRkPWZ1bmN0aW9uKHQpe2lmKGUuaXModCxcImFycmF5XCIpKWZvcih2YXIgcj10aGlzLnNldCgpLGk9MCxuPXQubGVuZ3RoLGE7bj5pO2krKylhPXRbaV18fHt9LEJbVF0oYS50eXBlKSYmci5wdXNoKHRoaXNbYS50eXBlXSgpLmF0dHIoYSkpO3JldHVybiByfSxlLmZvcm1hdD1mdW5jdGlvbih0LHIpe3ZhciBpPWUuaXMocixRKT9bMF1bUF0ocik6YXJndW1lbnRzO3JldHVybiB0JiZlLmlzKHQsWikmJmkubGVuZ3RoLTEmJih0PXQucmVwbGFjZShDLGZ1bmN0aW9uKHQsZSl7cmV0dXJuIG51bGw9PWlbKytlXT9SOmlbZV19KSksdHx8Un0sZS5mdWxsZmlsbD1mdW5jdGlvbigpe3ZhciB0PS9cXHsoW15cXH1dKylcXH0vZyxlPS8oPzooPzpefFxcLikoLis/KSg/PVxcW3xcXC58JHxcXCgpfFxcWygnfFwiKSguKz8pXFwyXFxdKShcXChcXCkpPy9nLHI9ZnVuY3Rpb24odCxyLGkpe3ZhciBuPWk7cmV0dXJuIHIucmVwbGFjZShlLGZ1bmN0aW9uKHQsZSxyLGksYSl7ZT1lfHxpLG4mJihlIGluIG4mJihuPW5bZV0pLFwiZnVuY3Rpb25cIj09dHlwZW9mIG4mJmEmJihuPW4oKSkpfSksbj0obnVsbD09bnx8bj09aT90Om4pK1wiXCJ9O3JldHVybiBmdW5jdGlvbihlLGkpe3JldHVybiBTdHJpbmcoZSkucmVwbGFjZSh0LGZ1bmN0aW9uKHQsZSl7cmV0dXJuIHIodCxlLGkpfSl9fSgpLGUubmluamE9ZnVuY3Rpb24oKXtpZihFLndhcylBLndpbi5SYXBoYWVsPUUuaXM7ZWxzZXt3aW5kb3cuUmFwaGFlbD12b2lkIDA7dHJ5e2RlbGV0ZSB3aW5kb3cuUmFwaGFlbH1jYXRjaCh0KXt9fXJldHVybiBlfSxlLnN0PVBlLHQub24oXCJyYXBoYWVsLkRPTWxvYWRcIixmdW5jdGlvbigpe3c9ITB9KSxmdW5jdGlvbih0LHIsaSl7ZnVuY3Rpb24gbigpey9pbi8udGVzdCh0LnJlYWR5U3RhdGUpP3NldFRpbWVvdXQobiw5KTplLmV2ZShcInJhcGhhZWwuRE9NbG9hZFwiKX1udWxsPT10LnJlYWR5U3RhdGUmJnQuYWRkRXZlbnRMaXN0ZW5lciYmKHQuYWRkRXZlbnRMaXN0ZW5lcihyLGk9ZnVuY3Rpb24oKXt0LnJlbW92ZUV2ZW50TGlzdGVuZXIocixpLCExKSx0LnJlYWR5U3RhdGU9XCJjb21wbGV0ZVwifSwhMSksdC5yZWFkeVN0YXRlPVwibG9hZGluZ1wiKSxuKCl9KGRvY3VtZW50LFwiRE9NQ29udGVudExvYWRlZFwiKSxlfS5hcHBseShlLGkpLCEodm9pZCAwIT09biYmKHQuZXhwb3J0cz1uKSl9LGZ1bmN0aW9uKHQsZSxyKXt2YXIgaSxuOyFmdW5jdGlvbihyKXt2YXIgYT1cIjAuNC4yXCIscz1cImhhc093blByb3BlcnR5XCIsbz0vW1xcLlxcL10vLGw9XCIqXCIsaD1mdW5jdGlvbigpe30sdT1mdW5jdGlvbih0LGUpe3JldHVybiB0LWV9LGMsZixwPXtuOnt9fSxkPWZ1bmN0aW9uKHQsZSl7dD1TdHJpbmcodCk7dmFyIHI9cCxpPWYsbj1BcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsMiksYT1kLmxpc3RlbmVycyh0KSxzPTAsbz0hMSxsLGg9W10sZz17fSx4PVtdLHY9Yyx5PVtdO2M9dCxmPTA7Zm9yKHZhciBtPTAsYj1hLmxlbmd0aDtiPm07bSsrKVwiekluZGV4XCJpbiBhW21dJiYoaC5wdXNoKGFbbV0uekluZGV4KSxhW21dLnpJbmRleDwwJiYoZ1thW21dLnpJbmRleF09YVttXSkpO2ZvcihoLnNvcnQodSk7aFtzXTwwOylpZihsPWdbaFtzKytdXSx4LnB1c2gobC5hcHBseShlLG4pKSxmKXJldHVybiBmPWkseDtmb3IobT0wO2I+bTttKyspaWYobD1hW21dLFwiekluZGV4XCJpbiBsKWlmKGwuekluZGV4PT1oW3NdKXtpZih4LnB1c2gobC5hcHBseShlLG4pKSxmKWJyZWFrO2RvIGlmKHMrKyxsPWdbaFtzXV0sbCYmeC5wdXNoKGwuYXBwbHkoZSxuKSksZilicmVhazt3aGlsZShsKX1lbHNlIGdbbC56SW5kZXhdPWw7ZWxzZSBpZih4LnB1c2gobC5hcHBseShlLG4pKSxmKWJyZWFrO3JldHVybiBmPWksYz12LHgubGVuZ3RoP3g6bnVsbH07ZC5fZXZlbnRzPXAsZC5saXN0ZW5lcnM9ZnVuY3Rpb24odCl7dmFyIGU9dC5zcGxpdChvKSxyPXAsaSxuLGEscyxoLHUsYyxmLGQ9W3JdLGc9W107Zm9yKHM9MCxoPWUubGVuZ3RoO2g+cztzKyspe2ZvcihmPVtdLHU9MCxjPWQubGVuZ3RoO2M+dTt1KyspZm9yKHI9ZFt1XS5uLG49W3JbZVtzXV0scltsXV0sYT0yO2EtLTspaT1uW2FdLGkmJihmLnB1c2goaSksZz1nLmNvbmNhdChpLmZ8fFtdKSk7ZD1mfXJldHVybiBnfSxkLm9uPWZ1bmN0aW9uKHQsZSl7aWYodD1TdHJpbmcodCksXCJmdW5jdGlvblwiIT10eXBlb2YgZSlyZXR1cm4gZnVuY3Rpb24oKXt9O2Zvcih2YXIgcj10LnNwbGl0KG8pLGk9cCxuPTAsYT1yLmxlbmd0aDthPm47bisrKWk9aS5uLGk9aS5oYXNPd25Qcm9wZXJ0eShyW25dKSYmaVtyW25dXXx8KGlbcltuXV09e246e319KTtmb3IoaS5mPWkuZnx8W10sbj0wLGE9aS5mLmxlbmd0aDthPm47bisrKWlmKGkuZltuXT09ZSlyZXR1cm4gaDtyZXR1cm4gaS5mLnB1c2goZSksZnVuY3Rpb24odCl7K3Q9PSt0JiYoZS56SW5kZXg9K3QpfX0sZC5mPWZ1bmN0aW9uKHQpe3ZhciBlPVtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLDEpO3JldHVybiBmdW5jdGlvbigpe2QuYXBwbHkobnVsbCxbdCxudWxsXS5jb25jYXQoZSkuY29uY2F0KFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLDApKSl9fSxkLnN0b3A9ZnVuY3Rpb24oKXtmPTF9LGQubnQ9ZnVuY3Rpb24odCl7cmV0dXJuIHQ/bmV3IFJlZ0V4cChcIig/OlxcXFwufFxcXFwvfF4pXCIrdCtcIig/OlxcXFwufFxcXFwvfCQpXCIpLnRlc3QoYyk6Y30sZC5udHM9ZnVuY3Rpb24oKXtyZXR1cm4gYy5zcGxpdChvKX0sZC5vZmY9ZC51bmJpbmQ9ZnVuY3Rpb24odCxlKXtpZighdClyZXR1cm4gdm9pZChkLl9ldmVudHM9cD17bjp7fX0pO3ZhciByPXQuc3BsaXQobyksaSxuLGEsaCx1LGMsZixnPVtwXTtmb3IoaD0wLHU9ci5sZW5ndGg7dT5oO2grKylmb3IoYz0wO2M8Zy5sZW5ndGg7Yys9YS5sZW5ndGgtMil7aWYoYT1bYywxXSxpPWdbY10ubixyW2hdIT1sKWlbcltoXV0mJmEucHVzaChpW3JbaF1dKTtlbHNlIGZvcihuIGluIGkpaVtzXShuKSYmYS5wdXNoKGlbbl0pO2cuc3BsaWNlLmFwcGx5KGcsYSl9Zm9yKGg9MCx1PWcubGVuZ3RoO3U+aDtoKyspZm9yKGk9Z1toXTtpLm47KXtpZihlKXtpZihpLmYpe2ZvcihjPTAsZj1pLmYubGVuZ3RoO2Y+YztjKyspaWYoaS5mW2NdPT1lKXtpLmYuc3BsaWNlKGMsMSk7YnJlYWt9IWkuZi5sZW5ndGgmJmRlbGV0ZSBpLmZ9Zm9yKG4gaW4gaS5uKWlmKGkubltzXShuKSYmaS5uW25dLmYpe3ZhciB4PWkubltuXS5mO2ZvcihjPTAsZj14Lmxlbmd0aDtmPmM7YysrKWlmKHhbY109PWUpe3guc3BsaWNlKGMsMSk7YnJlYWt9IXgubGVuZ3RoJiZkZWxldGUgaS5uW25dLmZ9fWVsc2V7ZGVsZXRlIGkuZjtmb3IobiBpbiBpLm4paS5uW3NdKG4pJiZpLm5bbl0uZiYmZGVsZXRlIGkubltuXS5mfWk9aS5ufX0sZC5vbmNlPWZ1bmN0aW9uKHQsZSl7dmFyIHI9ZnVuY3Rpb24oKXtyZXR1cm4gZC51bmJpbmQodCxyKSxlLmFwcGx5KHRoaXMsYXJndW1lbnRzKX07cmV0dXJuIGQub24odCxyKX0sZC52ZXJzaW9uPWEsZC50b1N0cmluZz1mdW5jdGlvbigpe3JldHVyblwiWW91IGFyZSBydW5uaW5nIEV2ZSBcIithfSxcInVuZGVmaW5lZFwiIT10eXBlb2YgdCYmdC5leHBvcnRzP3QuZXhwb3J0cz1kOihpPVtdLG49ZnVuY3Rpb24oKXtyZXR1cm4gZH0uYXBwbHkoZSxpKSwhKHZvaWQgMCE9PW4mJih0LmV4cG9ydHM9bikpKX0odGhpcyl9LGZ1bmN0aW9uKHQsZSxyKXt2YXIgaSxuO2k9W3IoMSldLG49ZnVuY3Rpb24odCl7aWYoIXR8fHQuc3ZnKXt2YXIgZT1cImhhc093blByb3BlcnR5XCIscj1TdHJpbmcsaT1wYXJzZUZsb2F0LG49cGFyc2VJbnQsYT1NYXRoLHM9YS5tYXgsbz1hLmFicyxsPWEucG93LGg9L1ssIF0rLyx1PXQuZXZlLGM9XCJcIixmPVwiIFwiLHA9XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCIsZD17YmxvY2s6XCJNNSwwIDAsMi41IDUsNXpcIixjbGFzc2ljOlwiTTUsMCAwLDIuNSA1LDUgMy41LDMgMy41LDJ6XCIsZGlhbW9uZDpcIk0yLjUsMCA1LDIuNSAyLjUsNSAwLDIuNXpcIixvcGVuOlwiTTYsMSAxLDMuNSA2LDZcIixvdmFsOlwiTTIuNSwwQTIuNSwyLjUsMCwwLDEsMi41LDUgMi41LDIuNSwwLDAsMSwyLjUsMHpcIn0sZz17fTt0LnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJZb3VyIGJyb3dzZXIgc3VwcG9ydHMgU1ZHLlxcbllvdSBhcmUgcnVubmluZyBSYXBoYcOrbCBcIit0aGlzLnZlcnNpb259O3ZhciB4PWZ1bmN0aW9uKGksbil7aWYobil7XCJzdHJpbmdcIj09dHlwZW9mIGkmJihpPXgoaSkpO2Zvcih2YXIgYSBpbiBuKW5bZV0oYSkmJihcInhsaW5rOlwiPT1hLnN1YnN0cmluZygwLDYpP2kuc2V0QXR0cmlidXRlTlMocCxhLnN1YnN0cmluZyg2KSxyKG5bYV0pKTppLnNldEF0dHJpYnV0ZShhLHIoblthXSkpKX1lbHNlIGk9dC5fZy5kb2MuY3JlYXRlRWxlbWVudE5TKFwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIixpKSxpLnN0eWxlJiYoaS5zdHlsZS53ZWJraXRUYXBIaWdobGlnaHRDb2xvcj1cInJnYmEoMCwwLDAsMClcIik7cmV0dXJuIGl9LHY9ZnVuY3Rpb24oZSxuKXt2YXIgaD1cImxpbmVhclwiLHU9ZS5pZCtuLGY9LjUscD0uNSxkPWUubm9kZSxnPWUucGFwZXIsdj1kLnN0eWxlLHk9dC5fZy5kb2MuZ2V0RWxlbWVudEJ5SWQodSk7aWYoIXkpe2lmKG49cihuKS5yZXBsYWNlKHQuX3JhZGlhbF9ncmFkaWVudCxmdW5jdGlvbih0LGUscil7aWYoaD1cInJhZGlhbFwiLGUmJnIpe2Y9aShlKSxwPWkocik7dmFyIG49MioocD4uNSktMTtsKGYtLjUsMikrbChwLS41LDIpPi4yNSYmKHA9YS5zcXJ0KC4yNS1sKGYtLjUsMikpKm4rLjUpJiYuNSE9cCYmKHA9cC50b0ZpeGVkKDUpLTFlLTUqbil9cmV0dXJuIGN9KSxuPW4uc3BsaXQoL1xccypcXC1cXHMqLyksXCJsaW5lYXJcIj09aCl7dmFyIGI9bi5zaGlmdCgpO2lmKGI9LWkoYiksaXNOYU4oYikpcmV0dXJuIG51bGw7dmFyIF89WzAsMCxhLmNvcyh0LnJhZChiKSksYS5zaW4odC5yYWQoYikpXSx3PTEvKHMobyhfWzJdKSxvKF9bM10pKXx8MSk7X1syXSo9dyxfWzNdKj13LF9bMl08MCYmKF9bMF09LV9bMl0sX1syXT0wKSxfWzNdPDAmJihfWzFdPS1fWzNdLF9bM109MCl9dmFyIGs9dC5fcGFyc2VEb3RzKG4pO2lmKCFrKXJldHVybiBudWxsO2lmKHU9dS5yZXBsYWNlKC9bXFwoXFwpXFxzLFxceGIwI10vZyxcIl9cIiksZS5ncmFkaWVudCYmdSE9ZS5ncmFkaWVudC5pZCYmKGcuZGVmcy5yZW1vdmVDaGlsZChlLmdyYWRpZW50KSxkZWxldGUgZS5ncmFkaWVudCksIWUuZ3JhZGllbnQpe3k9eChoK1wiR3JhZGllbnRcIix7aWQ6dX0pLGUuZ3JhZGllbnQ9eSx4KHksXCJyYWRpYWxcIj09aD97Zng6ZixmeTpwfTp7eDE6X1swXSx5MTpfWzFdLHgyOl9bMl0seTI6X1szXSxncmFkaWVudFRyYW5zZm9ybTplLm1hdHJpeC5pbnZlcnQoKX0pLGcuZGVmcy5hcHBlbmRDaGlsZCh5KTtmb3IodmFyIEI9MCxDPWsubGVuZ3RoO0M+QjtCKyspeS5hcHBlbmRDaGlsZCh4KFwic3RvcFwiLHtvZmZzZXQ6a1tCXS5vZmZzZXQ/a1tCXS5vZmZzZXQ6Qj9cIjEwMCVcIjpcIjAlXCIsXCJzdG9wLWNvbG9yXCI6a1tCXS5jb2xvcnx8XCIjZmZmXCIsXCJzdG9wLW9wYWNpdHlcIjppc0Zpbml0ZShrW0JdLm9wYWNpdHkpP2tbQl0ub3BhY2l0eToxfSkpfX1yZXR1cm4geChkLHtmaWxsOm0odSksb3BhY2l0eToxLFwiZmlsbC1vcGFjaXR5XCI6MX0pLHYuZmlsbD1jLHYub3BhY2l0eT0xLHYuZmlsbE9wYWNpdHk9MSwxfSx5PWZ1bmN0aW9uKCl7dmFyIHQ9ZG9jdW1lbnQuZG9jdW1lbnRNb2RlO3JldHVybiB0JiYoOT09PXR8fDEwPT09dCl9LG09ZnVuY3Rpb24odCl7aWYoeSgpKXJldHVyblwidXJsKCcjXCIrdCtcIicpXCI7dmFyIGU9ZG9jdW1lbnQubG9jYXRpb24scj1lLnByb3RvY29sK1wiLy9cIitlLmhvc3QrZS5wYXRobmFtZStlLnNlYXJjaDtyZXR1cm5cInVybCgnXCIrcitcIiNcIit0K1wiJylcIn0sYj1mdW5jdGlvbih0KXt2YXIgZT10LmdldEJCb3goMSk7eCh0LnBhdHRlcm4se3BhdHRlcm5UcmFuc2Zvcm06dC5tYXRyaXguaW52ZXJ0KCkrXCIgdHJhbnNsYXRlKFwiK2UueCtcIixcIitlLnkrXCIpXCJ9KX0sXz1mdW5jdGlvbihpLG4sYSl7aWYoXCJwYXRoXCI9PWkudHlwZSl7Zm9yKHZhciBzPXIobikudG9Mb3dlckNhc2UoKS5zcGxpdChcIi1cIiksbz1pLnBhcGVyLGw9YT9cImVuZFwiOlwic3RhcnRcIixoPWkubm9kZSx1PWkuYXR0cnMsZj11W1wic3Ryb2tlLXdpZHRoXCJdLHA9cy5sZW5ndGgsdj1cImNsYXNzaWNcIix5LG0sYixfLHcsaz0zLEI9MyxDPTU7cC0tOylzd2l0Y2goc1twXSl7Y2FzZVwiYmxvY2tcIjpjYXNlXCJjbGFzc2ljXCI6Y2FzZVwib3ZhbFwiOmNhc2VcImRpYW1vbmRcIjpjYXNlXCJvcGVuXCI6Y2FzZVwibm9uZVwiOnY9c1twXTticmVhaztjYXNlXCJ3aWRlXCI6Qj01O2JyZWFrO2Nhc2VcIm5hcnJvd1wiOkI9MjticmVhaztjYXNlXCJsb25nXCI6az01O2JyZWFrO2Nhc2VcInNob3J0XCI6az0yfWlmKFwib3BlblwiPT12PyhrKz0yLEIrPTIsQys9MixiPTEsXz1hPzQ6MSx3PXtmaWxsOlwibm9uZVwiLHN0cm9rZTp1LnN0cm9rZX0pOihfPWI9ay8yLHc9e2ZpbGw6dS5zdHJva2Usc3Ryb2tlOlwibm9uZVwifSksaS5fLmFycm93cz9hPyhpLl8uYXJyb3dzLmVuZFBhdGgmJmdbaS5fLmFycm93cy5lbmRQYXRoXS0tLGkuXy5hcnJvd3MuZW5kTWFya2VyJiZnW2kuXy5hcnJvd3MuZW5kTWFya2VyXS0tKTooaS5fLmFycm93cy5zdGFydFBhdGgmJmdbaS5fLmFycm93cy5zdGFydFBhdGhdLS0saS5fLmFycm93cy5zdGFydE1hcmtlciYmZ1tpLl8uYXJyb3dzLnN0YXJ0TWFya2VyXS0tKTppLl8uYXJyb3dzPXt9LFwibm9uZVwiIT12KXt2YXIgUz1cInJhcGhhZWwtbWFya2VyLVwiK3YsVD1cInJhcGhhZWwtbWFya2VyLVwiK2wrditrK0IrXCItb2JqXCIraS5pZDt0Ll9nLmRvYy5nZXRFbGVtZW50QnlJZChTKT9nW1NdKys6KG8uZGVmcy5hcHBlbmRDaGlsZCh4KHgoXCJwYXRoXCIpLHtcInN0cm9rZS1saW5lY2FwXCI6XCJyb3VuZFwiLGQ6ZFt2XSxpZDpTfSkpLGdbU109MSk7dmFyIEE9dC5fZy5kb2MuZ2V0RWxlbWVudEJ5SWQoVCksRTtBPyhnW1RdKyssRT1BLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwidXNlXCIpWzBdKTooQT14KHgoXCJtYXJrZXJcIikse2lkOlQsbWFya2VySGVpZ2h0OkIsbWFya2VyV2lkdGg6ayxvcmllbnQ6XCJhdXRvXCIscmVmWDpfLHJlZlk6Qi8yfSksRT14KHgoXCJ1c2VcIikse1wieGxpbms6aHJlZlwiOlwiI1wiK1MsdHJhbnNmb3JtOihhP1wicm90YXRlKDE4MCBcIitrLzIrXCIgXCIrQi8yK1wiKSBcIjpjKStcInNjYWxlKFwiK2svQytcIixcIitCL0MrXCIpXCIsXCJzdHJva2Utd2lkdGhcIjooMS8oKGsvQytCL0MpLzIpKS50b0ZpeGVkKDQpfSksQS5hcHBlbmRDaGlsZChFKSxvLmRlZnMuYXBwZW5kQ2hpbGQoQSksZ1tUXT0xKSx4KEUsdyk7dmFyIE49YiooXCJkaWFtb25kXCIhPXYmJlwib3ZhbFwiIT12KTthPyh5PWkuXy5hcnJvd3Muc3RhcnRkeCpmfHwwLG09dC5nZXRUb3RhbExlbmd0aCh1LnBhdGgpLU4qZik6KHk9TipmLG09dC5nZXRUb3RhbExlbmd0aCh1LnBhdGgpLShpLl8uYXJyb3dzLmVuZGR4KmZ8fDApKSx3PXt9LHdbXCJtYXJrZXItXCIrbF09XCJ1cmwoI1wiK1QrXCIpXCIsKG18fHkpJiYody5kPXQuZ2V0U3VicGF0aCh1LnBhdGgseSxtKSkseChoLHcpLGkuXy5hcnJvd3NbbCtcIlBhdGhcIl09UyxpLl8uYXJyb3dzW2wrXCJNYXJrZXJcIl09VCxpLl8uYXJyb3dzW2wrXCJkeFwiXT1OLGkuXy5hcnJvd3NbbCtcIlR5cGVcIl09dixpLl8uYXJyb3dzW2wrXCJTdHJpbmdcIl09bn1lbHNlIGE/KHk9aS5fLmFycm93cy5zdGFydGR4KmZ8fDAsbT10LmdldFRvdGFsTGVuZ3RoKHUucGF0aCkteSk6KHk9MCxtPXQuZ2V0VG90YWxMZW5ndGgodS5wYXRoKS0oaS5fLmFycm93cy5lbmRkeCpmfHwwKSksaS5fLmFycm93c1tsK1wiUGF0aFwiXSYmeChoLHtkOnQuZ2V0U3VicGF0aCh1LnBhdGgseSxtKX0pLGRlbGV0ZSBpLl8uYXJyb3dzW2wrXCJQYXRoXCJdLGRlbGV0ZSBpLl8uYXJyb3dzW2wrXCJNYXJrZXJcIl0sZGVsZXRlIGkuXy5hcnJvd3NbbCtcImR4XCJdLGRlbGV0ZSBpLl8uYXJyb3dzW2wrXCJUeXBlXCJdLGRlbGV0ZSBpLl8uYXJyb3dzW2wrXCJTdHJpbmdcIl07Zm9yKHcgaW4gZylpZihnW2VdKHcpJiYhZ1t3XSl7dmFyIE09dC5fZy5kb2MuZ2V0RWxlbWVudEJ5SWQodyk7TSYmTS5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKE0pfX19LHc9e1wiLVwiOlszLDFdLFwiLlwiOlsxLDFdLFwiLS5cIjpbMywxLDEsMV0sXCItLi5cIjpbMywxLDEsMSwxLDFdLFwiLiBcIjpbMSwzXSxcIi0gXCI6WzQsM10sXCItLVwiOls4LDNdLFwiLSAuXCI6WzQsMywxLDNdLFwiLS0uXCI6WzgsMywxLDNdLFwiLS0uLlwiOls4LDMsMSwzLDEsM119LGs9ZnVuY3Rpb24odCxlLGkpe2lmKGU9d1tyKGUpLnRvTG93ZXJDYXNlKCldKXtmb3IodmFyIG49dC5hdHRyc1tcInN0cm9rZS13aWR0aFwiXXx8XCIxXCIsYT17cm91bmQ6bixzcXVhcmU6bixidXR0OjB9W3QuYXR0cnNbXCJzdHJva2UtbGluZWNhcFwiXXx8aVtcInN0cm9rZS1saW5lY2FwXCJdXXx8MCxzPVtdLG89ZS5sZW5ndGg7by0tOylzW29dPWVbb10qbisobyUyPzE6LTEpKmE7eCh0Lm5vZGUse1wic3Ryb2tlLWRhc2hhcnJheVwiOnMuam9pbihcIixcIil9KX1lbHNlIHgodC5ub2RlLHtcInN0cm9rZS1kYXNoYXJyYXlcIjpcIm5vbmVcIn0pfSxCPWZ1bmN0aW9uKGksYSl7dmFyIGw9aS5ub2RlLHU9aS5hdHRycyxmPWwuc3R5bGUudmlzaWJpbGl0eTtsLnN0eWxlLnZpc2liaWxpdHk9XCJoaWRkZW5cIjtmb3IodmFyIGQgaW4gYSlpZihhW2VdKGQpKXtpZighdC5fYXZhaWxhYmxlQXR0cnNbZV0oZCkpY29udGludWU7dmFyIGc9YVtkXTtzd2l0Y2godVtkXT1nLGQpe2Nhc2VcImJsdXJcIjppLmJsdXIoZyk7YnJlYWs7Y2FzZVwidGl0bGVcIjp2YXIgeT1sLmdldEVsZW1lbnRzQnlUYWdOYW1lKFwidGl0bGVcIik7aWYoeS5sZW5ndGgmJih5PXlbMF0pKXkuZmlyc3RDaGlsZC5ub2RlVmFsdWU9ZztlbHNle3k9eChcInRpdGxlXCIpO3ZhciBtPXQuX2cuZG9jLmNyZWF0ZVRleHROb2RlKGcpO3kuYXBwZW5kQ2hpbGQobSksbC5hcHBlbmRDaGlsZCh5KX1icmVhaztjYXNlXCJocmVmXCI6Y2FzZVwidGFyZ2V0XCI6dmFyIHc9bC5wYXJlbnROb2RlO2lmKFwiYVwiIT13LnRhZ05hbWUudG9Mb3dlckNhc2UoKSl7dmFyIEI9eChcImFcIik7dy5pbnNlcnRCZWZvcmUoQixsKSxCLmFwcGVuZENoaWxkKGwpLHc9Qn1cInRhcmdldFwiPT1kP3cuc2V0QXR0cmlidXRlTlMocCxcInNob3dcIixcImJsYW5rXCI9PWc/XCJuZXdcIjpnKTp3LnNldEF0dHJpYnV0ZU5TKHAsZCxnKTticmVhaztjYXNlXCJjdXJzb3JcIjpsLnN0eWxlLmN1cnNvcj1nO2JyZWFrO2Nhc2VcInRyYW5zZm9ybVwiOmkudHJhbnNmb3JtKGcpO2JyZWFrO2Nhc2VcImFycm93LXN0YXJ0XCI6XyhpLGcpO2JyZWFrO2Nhc2VcImFycm93LWVuZFwiOl8oaSxnLDEpO2JyZWFrO2Nhc2VcImNsaXAtcmVjdFwiOnZhciBDPXIoZykuc3BsaXQoaCk7aWYoND09Qy5sZW5ndGgpe2kuY2xpcCYmaS5jbGlwLnBhcmVudE5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChpLmNsaXAucGFyZW50Tm9kZSk7dmFyIFQ9eChcImNsaXBQYXRoXCIpLEE9eChcInJlY3RcIik7VC5pZD10LmNyZWF0ZVVVSUQoKSx4KEEse3g6Q1swXSx5OkNbMV0sd2lkdGg6Q1syXSxoZWlnaHQ6Q1szXX0pLFQuYXBwZW5kQ2hpbGQoQSksaS5wYXBlci5kZWZzLmFwcGVuZENoaWxkKFQpLHgobCx7XCJjbGlwLXBhdGhcIjpcInVybCgjXCIrVC5pZCtcIilcIn0pLGkuY2xpcD1BfWlmKCFnKXt2YXIgRT1sLmdldEF0dHJpYnV0ZShcImNsaXAtcGF0aFwiKTtpZihFKXt2YXIgTj10Ll9nLmRvYy5nZXRFbGVtZW50QnlJZChFLnJlcGxhY2UoLyhedXJsXFwoI3xcXCkkKS9nLGMpKTtOJiZOLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoTikseChsLHtcImNsaXAtcGF0aFwiOmN9KSxkZWxldGUgaS5jbGlwfX1icmVhaztjYXNlXCJwYXRoXCI6XCJwYXRoXCI9PWkudHlwZSYmKHgobCx7ZDpnP3UucGF0aD10Ll9wYXRoVG9BYnNvbHV0ZShnKTpcIk0wLDBcIn0pLGkuXy5kaXJ0eT0xLGkuXy5hcnJvd3MmJihcInN0YXJ0U3RyaW5nXCJpbiBpLl8uYXJyb3dzJiZfKGksaS5fLmFycm93cy5zdGFydFN0cmluZyksXCJlbmRTdHJpbmdcImluIGkuXy5hcnJvd3MmJl8oaSxpLl8uYXJyb3dzLmVuZFN0cmluZywxKSkpO2JyZWFrO2Nhc2VcIndpZHRoXCI6aWYobC5zZXRBdHRyaWJ1dGUoZCxnKSxpLl8uZGlydHk9MSwhdS5meClicmVhaztkPVwieFwiLGc9dS54O2Nhc2VcInhcIjp1LmZ4JiYoZz0tdS54LSh1LndpZHRofHwwKSk7Y2FzZVwicnhcIjppZihcInJ4XCI9PWQmJlwicmVjdFwiPT1pLnR5cGUpYnJlYWs7Y2FzZVwiY3hcIjpsLnNldEF0dHJpYnV0ZShkLGcpLGkucGF0dGVybiYmYihpKSxpLl8uZGlydHk9MTticmVhaztjYXNlXCJoZWlnaHRcIjppZihsLnNldEF0dHJpYnV0ZShkLGcpLGkuXy5kaXJ0eT0xLCF1LmZ5KWJyZWFrO2Q9XCJ5XCIsZz11Lnk7Y2FzZVwieVwiOnUuZnkmJihnPS11LnktKHUuaGVpZ2h0fHwwKSk7Y2FzZVwicnlcIjppZihcInJ5XCI9PWQmJlwicmVjdFwiPT1pLnR5cGUpYnJlYWs7Y2FzZVwiY3lcIjpsLnNldEF0dHJpYnV0ZShkLGcpLGkucGF0dGVybiYmYihpKSxpLl8uZGlydHk9MTticmVhaztjYXNlXCJyXCI6XCJyZWN0XCI9PWkudHlwZT94KGwse3J4Omcscnk6Z30pOmwuc2V0QXR0cmlidXRlKGQsZyksaS5fLmRpcnR5PTE7YnJlYWs7Y2FzZVwic3JjXCI6XCJpbWFnZVwiPT1pLnR5cGUmJmwuc2V0QXR0cmlidXRlTlMocCxcImhyZWZcIixnKTticmVhaztjYXNlXCJzdHJva2Utd2lkdGhcIjoxPT1pLl8uc3gmJjE9PWkuXy5zeXx8KGcvPXMobyhpLl8uc3gpLG8oaS5fLnN5KSl8fDEpLGwuc2V0QXR0cmlidXRlKGQsZyksdVtcInN0cm9rZS1kYXNoYXJyYXlcIl0mJmsoaSx1W1wic3Ryb2tlLWRhc2hhcnJheVwiXSxhKSxpLl8uYXJyb3dzJiYoXCJzdGFydFN0cmluZ1wiaW4gaS5fLmFycm93cyYmXyhpLGkuXy5hcnJvd3Muc3RhcnRTdHJpbmcpLFwiZW5kU3RyaW5nXCJpbiBpLl8uYXJyb3dzJiZfKGksaS5fLmFycm93cy5lbmRTdHJpbmcsMSkpO2JyZWFrO2Nhc2VcInN0cm9rZS1kYXNoYXJyYXlcIjprKGksZyxhKTticmVhaztjYXNlXCJmaWxsXCI6dmFyIE09cihnKS5tYXRjaCh0Ll9JU1VSTCk7aWYoTSl7VD14KFwicGF0dGVyblwiKTt2YXIgTD14KFwiaW1hZ2VcIik7VC5pZD10LmNyZWF0ZVVVSUQoKSx4KFQse3g6MCx5OjAscGF0dGVyblVuaXRzOlwidXNlclNwYWNlT25Vc2VcIixoZWlnaHQ6MSx3aWR0aDoxfSkseChMLHt4OjAseTowLFwieGxpbms6aHJlZlwiOk1bMV19KSxULmFwcGVuZENoaWxkKEwpLGZ1bmN0aW9uKGUpe3QuX3ByZWxvYWQoTVsxXSxmdW5jdGlvbigpe3ZhciB0PXRoaXMub2Zmc2V0V2lkdGgscj10aGlzLm9mZnNldEhlaWdodDt4KGUse3dpZHRoOnQsaGVpZ2h0OnJ9KSx4KEwse3dpZHRoOnQsaGVpZ2h0OnJ9KX0pfShUKSxpLnBhcGVyLmRlZnMuYXBwZW5kQ2hpbGQoVCkseChsLHtmaWxsOlwidXJsKCNcIitULmlkK1wiKVwifSksaS5wYXR0ZXJuPVQsaS5wYXR0ZXJuJiZiKGkpO2JyZWFrfXZhciB6PXQuZ2V0UkdCKGcpO2lmKHouZXJyb3Ipe2lmKChcImNpcmNsZVwiPT1pLnR5cGV8fFwiZWxsaXBzZVwiPT1pLnR5cGV8fFwiclwiIT1yKGcpLmNoYXJBdCgpKSYmdihpLGcpKXtcbmlmKFwib3BhY2l0eVwiaW4gdXx8XCJmaWxsLW9wYWNpdHlcImluIHUpe3ZhciBQPXQuX2cuZG9jLmdldEVsZW1lbnRCeUlkKGwuZ2V0QXR0cmlidXRlKFwiZmlsbFwiKS5yZXBsYWNlKC9edXJsXFwoI3xcXCkkL2csYykpO2lmKFApe3ZhciBGPVAuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzdG9wXCIpO3goRltGLmxlbmd0aC0xXSx7XCJzdG9wLW9wYWNpdHlcIjooXCJvcGFjaXR5XCJpbiB1P3Uub3BhY2l0eToxKSooXCJmaWxsLW9wYWNpdHlcImluIHU/dVtcImZpbGwtb3BhY2l0eVwiXToxKX0pfX11LmdyYWRpZW50PWcsdS5maWxsPVwibm9uZVwiO2JyZWFrfX1lbHNlIGRlbGV0ZSBhLmdyYWRpZW50LGRlbGV0ZSB1LmdyYWRpZW50LCF0LmlzKHUub3BhY2l0eSxcInVuZGVmaW5lZFwiKSYmdC5pcyhhLm9wYWNpdHksXCJ1bmRlZmluZWRcIikmJngobCx7b3BhY2l0eTp1Lm9wYWNpdHl9KSwhdC5pcyh1W1wiZmlsbC1vcGFjaXR5XCJdLFwidW5kZWZpbmVkXCIpJiZ0LmlzKGFbXCJmaWxsLW9wYWNpdHlcIl0sXCJ1bmRlZmluZWRcIikmJngobCx7XCJmaWxsLW9wYWNpdHlcIjp1W1wiZmlsbC1vcGFjaXR5XCJdfSk7eltlXShcIm9wYWNpdHlcIikmJngobCx7XCJmaWxsLW9wYWNpdHlcIjp6Lm9wYWNpdHk+MT96Lm9wYWNpdHkvMTAwOnoub3BhY2l0eX0pO2Nhc2VcInN0cm9rZVwiOno9dC5nZXRSR0IoZyksbC5zZXRBdHRyaWJ1dGUoZCx6LmhleCksXCJzdHJva2VcIj09ZCYmeltlXShcIm9wYWNpdHlcIikmJngobCx7XCJzdHJva2Utb3BhY2l0eVwiOnoub3BhY2l0eT4xP3oub3BhY2l0eS8xMDA6ei5vcGFjaXR5fSksXCJzdHJva2VcIj09ZCYmaS5fLmFycm93cyYmKFwic3RhcnRTdHJpbmdcImluIGkuXy5hcnJvd3MmJl8oaSxpLl8uYXJyb3dzLnN0YXJ0U3RyaW5nKSxcImVuZFN0cmluZ1wiaW4gaS5fLmFycm93cyYmXyhpLGkuXy5hcnJvd3MuZW5kU3RyaW5nLDEpKTticmVhaztjYXNlXCJncmFkaWVudFwiOihcImNpcmNsZVwiPT1pLnR5cGV8fFwiZWxsaXBzZVwiPT1pLnR5cGV8fFwiclwiIT1yKGcpLmNoYXJBdCgpKSYmdihpLGcpO2JyZWFrO2Nhc2VcIm9wYWNpdHlcIjp1LmdyYWRpZW50JiYhdVtlXShcInN0cm9rZS1vcGFjaXR5XCIpJiZ4KGwse1wic3Ryb2tlLW9wYWNpdHlcIjpnPjE/Zy8xMDA6Z30pO2Nhc2VcImZpbGwtb3BhY2l0eVwiOmlmKHUuZ3JhZGllbnQpe1A9dC5fZy5kb2MuZ2V0RWxlbWVudEJ5SWQobC5nZXRBdHRyaWJ1dGUoXCJmaWxsXCIpLnJlcGxhY2UoL151cmxcXCgjfFxcKSQvZyxjKSksUCYmKEY9UC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInN0b3BcIikseChGW0YubGVuZ3RoLTFdLHtcInN0b3Atb3BhY2l0eVwiOmd9KSk7YnJlYWt9ZGVmYXVsdDpcImZvbnQtc2l6ZVwiPT1kJiYoZz1uKGcsMTApK1wicHhcIik7dmFyIFI9ZC5yZXBsYWNlKC8oXFwtLikvZyxmdW5jdGlvbih0KXtyZXR1cm4gdC5zdWJzdHJpbmcoMSkudG9VcHBlckNhc2UoKX0pO2wuc3R5bGVbUl09ZyxpLl8uZGlydHk9MSxsLnNldEF0dHJpYnV0ZShkLGcpfX1TKGksYSksbC5zdHlsZS52aXNpYmlsaXR5PWZ9LEM9MS4yLFM9ZnVuY3Rpb24oaSxhKXtpZihcInRleHRcIj09aS50eXBlJiYoYVtlXShcInRleHRcIil8fGFbZV0oXCJmb250XCIpfHxhW2VdKFwiZm9udC1zaXplXCIpfHxhW2VdKFwieFwiKXx8YVtlXShcInlcIikpKXt2YXIgcz1pLmF0dHJzLG89aS5ub2RlLGw9by5maXJzdENoaWxkP24odC5fZy5kb2MuZGVmYXVsdFZpZXcuZ2V0Q29tcHV0ZWRTdHlsZShvLmZpcnN0Q2hpbGQsYykuZ2V0UHJvcGVydHlWYWx1ZShcImZvbnQtc2l6ZVwiKSwxMCk6MTA7aWYoYVtlXShcInRleHRcIikpe2ZvcihzLnRleHQ9YS50ZXh0O28uZmlyc3RDaGlsZDspby5yZW1vdmVDaGlsZChvLmZpcnN0Q2hpbGQpO2Zvcih2YXIgaD1yKGEudGV4dCkuc3BsaXQoXCJcXG5cIiksdT1bXSxmLHA9MCxkPWgubGVuZ3RoO2Q+cDtwKyspZj14KFwidHNwYW5cIikscCYmeChmLHtkeTpsKkMseDpzLnh9KSxmLmFwcGVuZENoaWxkKHQuX2cuZG9jLmNyZWF0ZVRleHROb2RlKGhbcF0pKSxvLmFwcGVuZENoaWxkKGYpLHVbcF09Zn1lbHNlIGZvcih1PW8uZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJ0c3BhblwiKSxwPTAsZD11Lmxlbmd0aDtkPnA7cCsrKXA/eCh1W3BdLHtkeTpsKkMseDpzLnh9KTp4KHVbMF0se2R5OjB9KTt4KG8se3g6cy54LHk6cy55fSksaS5fLmRpcnR5PTE7dmFyIGc9aS5fZ2V0QkJveCgpLHY9cy55LShnLnkrZy5oZWlnaHQvMik7diYmdC5pcyh2LFwiZmluaXRlXCIpJiZ4KHVbMF0se2R5OnZ9KX19LFQ9ZnVuY3Rpb24odCl7cmV0dXJuIHQucGFyZW50Tm9kZSYmXCJhXCI9PT10LnBhcmVudE5vZGUudGFnTmFtZS50b0xvd2VyQ2FzZSgpP3QucGFyZW50Tm9kZTp0fSxBPWZ1bmN0aW9uKGUscil7dmFyIGk9MCxuPTA7dGhpc1swXT10aGlzLm5vZGU9ZSxlLnJhcGhhZWw9ITAsdGhpcy5pZD10Ll9vaWQrKyxlLnJhcGhhZWxpZD10aGlzLmlkLHRoaXMubWF0cml4PXQubWF0cml4KCksdGhpcy5yZWFsUGF0aD1udWxsLHRoaXMucGFwZXI9cix0aGlzLmF0dHJzPXRoaXMuYXR0cnN8fHt9LHRoaXMuXz17dHJhbnNmb3JtOltdLHN4OjEsc3k6MSxkZWc6MCxkeDowLGR5OjAsZGlydHk6MX0sIXIuYm90dG9tJiYoci5ib3R0b209dGhpcyksdGhpcy5wcmV2PXIudG9wLHIudG9wJiYoci50b3AubmV4dD10aGlzKSxyLnRvcD10aGlzLHRoaXMubmV4dD1udWxsfSxFPXQuZWw7QS5wcm90b3R5cGU9RSxFLmNvbnN0cnVjdG9yPUEsdC5fZW5naW5lLnBhdGg9ZnVuY3Rpb24odCxlKXt2YXIgcj14KFwicGF0aFwiKTtlLmNhbnZhcyYmZS5jYW52YXMuYXBwZW5kQ2hpbGQocik7dmFyIGk9bmV3IEEocixlKTtyZXR1cm4gaS50eXBlPVwicGF0aFwiLEIoaSx7ZmlsbDpcIm5vbmVcIixzdHJva2U6XCIjMDAwXCIscGF0aDp0fSksaX0sRS5yb3RhdGU9ZnVuY3Rpb24odCxlLG4pe2lmKHRoaXMucmVtb3ZlZClyZXR1cm4gdGhpcztpZih0PXIodCkuc3BsaXQoaCksdC5sZW5ndGgtMSYmKGU9aSh0WzFdKSxuPWkodFsyXSkpLHQ9aSh0WzBdKSxudWxsPT1uJiYoZT1uKSxudWxsPT1lfHxudWxsPT1uKXt2YXIgYT10aGlzLmdldEJCb3goMSk7ZT1hLngrYS53aWR0aC8yLG49YS55K2EuaGVpZ2h0LzJ9cmV0dXJuIHRoaXMudHJhbnNmb3JtKHRoaXMuXy50cmFuc2Zvcm0uY29uY2F0KFtbXCJyXCIsdCxlLG5dXSkpLHRoaXN9LEUuc2NhbGU9ZnVuY3Rpb24odCxlLG4sYSl7aWYodGhpcy5yZW1vdmVkKXJldHVybiB0aGlzO2lmKHQ9cih0KS5zcGxpdChoKSx0Lmxlbmd0aC0xJiYoZT1pKHRbMV0pLG49aSh0WzJdKSxhPWkodFszXSkpLHQ9aSh0WzBdKSxudWxsPT1lJiYoZT10KSxudWxsPT1hJiYobj1hKSxudWxsPT1ufHxudWxsPT1hKXZhciBzPXRoaXMuZ2V0QkJveCgxKTtyZXR1cm4gbj1udWxsPT1uP3MueCtzLndpZHRoLzI6bixhPW51bGw9PWE/cy55K3MuaGVpZ2h0LzI6YSx0aGlzLnRyYW5zZm9ybSh0aGlzLl8udHJhbnNmb3JtLmNvbmNhdChbW1wic1wiLHQsZSxuLGFdXSkpLHRoaXN9LEUudHJhbnNsYXRlPWZ1bmN0aW9uKHQsZSl7cmV0dXJuIHRoaXMucmVtb3ZlZD90aGlzOih0PXIodCkuc3BsaXQoaCksdC5sZW5ndGgtMSYmKGU9aSh0WzFdKSksdD1pKHRbMF0pfHwwLGU9K2V8fDAsdGhpcy50cmFuc2Zvcm0odGhpcy5fLnRyYW5zZm9ybS5jb25jYXQoW1tcInRcIix0LGVdXSkpLHRoaXMpfSxFLnRyYW5zZm9ybT1mdW5jdGlvbihyKXt2YXIgaT10aGlzLl87aWYobnVsbD09cilyZXR1cm4gaS50cmFuc2Zvcm07aWYodC5fZXh0cmFjdFRyYW5zZm9ybSh0aGlzLHIpLHRoaXMuY2xpcCYmeCh0aGlzLmNsaXAse3RyYW5zZm9ybTp0aGlzLm1hdHJpeC5pbnZlcnQoKX0pLHRoaXMucGF0dGVybiYmYih0aGlzKSx0aGlzLm5vZGUmJngodGhpcy5ub2RlLHt0cmFuc2Zvcm06dGhpcy5tYXRyaXh9KSwxIT1pLnN4fHwxIT1pLnN5KXt2YXIgbj10aGlzLmF0dHJzW2VdKFwic3Ryb2tlLXdpZHRoXCIpP3RoaXMuYXR0cnNbXCJzdHJva2Utd2lkdGhcIl06MTt0aGlzLmF0dHIoe1wic3Ryb2tlLXdpZHRoXCI6bn0pfXJldHVybiBpLnRyYW5zZm9ybT10aGlzLm1hdHJpeC50b1RyYW5zZm9ybVN0cmluZygpLHRoaXN9LEUuaGlkZT1mdW5jdGlvbigpe3JldHVybiB0aGlzLnJlbW92ZWR8fCh0aGlzLm5vZGUuc3R5bGUuZGlzcGxheT1cIm5vbmVcIiksdGhpc30sRS5zaG93PWZ1bmN0aW9uKCl7cmV0dXJuIHRoaXMucmVtb3ZlZHx8KHRoaXMubm9kZS5zdHlsZS5kaXNwbGF5PVwiXCIpLHRoaXN9LEUucmVtb3ZlPWZ1bmN0aW9uKCl7dmFyIGU9VCh0aGlzLm5vZGUpO2lmKCF0aGlzLnJlbW92ZWQmJmUucGFyZW50Tm9kZSl7dmFyIHI9dGhpcy5wYXBlcjtyLl9fc2V0X18mJnIuX19zZXRfXy5leGNsdWRlKHRoaXMpLHUudW5iaW5kKFwicmFwaGFlbC4qLiouXCIrdGhpcy5pZCksdGhpcy5ncmFkaWVudCYmci5kZWZzLnJlbW92ZUNoaWxkKHRoaXMuZ3JhZGllbnQpLHQuX3RlYXIodGhpcyxyKSxlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZSksdGhpcy5yZW1vdmVEYXRhKCk7Zm9yKHZhciBpIGluIHRoaXMpdGhpc1tpXT1cImZ1bmN0aW9uXCI9PXR5cGVvZiB0aGlzW2ldP3QuX3JlbW92ZWRGYWN0b3J5KGkpOm51bGw7dGhpcy5yZW1vdmVkPSEwfX0sRS5fZ2V0QkJveD1mdW5jdGlvbigpe2lmKFwibm9uZVwiPT10aGlzLm5vZGUuc3R5bGUuZGlzcGxheSl7dGhpcy5zaG93KCk7dmFyIHQ9ITB9dmFyIGU9ITEscjt0aGlzLnBhcGVyLmNhbnZhcy5wYXJlbnRFbGVtZW50P3I9dGhpcy5wYXBlci5jYW52YXMucGFyZW50RWxlbWVudC5zdHlsZTp0aGlzLnBhcGVyLmNhbnZhcy5wYXJlbnROb2RlJiYocj10aGlzLnBhcGVyLmNhbnZhcy5wYXJlbnROb2RlLnN0eWxlKSxyJiZcIm5vbmVcIj09ci5kaXNwbGF5JiYoZT0hMCxyLmRpc3BsYXk9XCJcIik7dmFyIGk9e307dHJ5e2k9dGhpcy5ub2RlLmdldEJCb3goKX1jYXRjaChuKXtpPXt4OnRoaXMubm9kZS5jbGllbnRMZWZ0LHk6dGhpcy5ub2RlLmNsaWVudFRvcCx3aWR0aDp0aGlzLm5vZGUuY2xpZW50V2lkdGgsaGVpZ2h0OnRoaXMubm9kZS5jbGllbnRIZWlnaHR9fWZpbmFsbHl7aT1pfHx7fSxlJiYoci5kaXNwbGF5PVwibm9uZVwiKX1yZXR1cm4gdCYmdGhpcy5oaWRlKCksaX0sRS5hdHRyPWZ1bmN0aW9uKHIsaSl7aWYodGhpcy5yZW1vdmVkKXJldHVybiB0aGlzO2lmKG51bGw9PXIpe3ZhciBuPXt9O2Zvcih2YXIgYSBpbiB0aGlzLmF0dHJzKXRoaXMuYXR0cnNbZV0oYSkmJihuW2FdPXRoaXMuYXR0cnNbYV0pO3JldHVybiBuLmdyYWRpZW50JiZcIm5vbmVcIj09bi5maWxsJiYobi5maWxsPW4uZ3JhZGllbnQpJiZkZWxldGUgbi5ncmFkaWVudCxuLnRyYW5zZm9ybT10aGlzLl8udHJhbnNmb3JtLG59aWYobnVsbD09aSYmdC5pcyhyLFwic3RyaW5nXCIpKXtpZihcImZpbGxcIj09ciYmXCJub25lXCI9PXRoaXMuYXR0cnMuZmlsbCYmdGhpcy5hdHRycy5ncmFkaWVudClyZXR1cm4gdGhpcy5hdHRycy5ncmFkaWVudDtpZihcInRyYW5zZm9ybVwiPT1yKXJldHVybiB0aGlzLl8udHJhbnNmb3JtO2Zvcih2YXIgcz1yLnNwbGl0KGgpLG89e30sbD0wLGM9cy5sZW5ndGg7Yz5sO2wrKylyPXNbbF0sciBpbiB0aGlzLmF0dHJzP29bcl09dGhpcy5hdHRyc1tyXTp0LmlzKHRoaXMucGFwZXIuY3VzdG9tQXR0cmlidXRlc1tyXSxcImZ1bmN0aW9uXCIpP29bcl09dGhpcy5wYXBlci5jdXN0b21BdHRyaWJ1dGVzW3JdLmRlZjpvW3JdPXQuX2F2YWlsYWJsZUF0dHJzW3JdO3JldHVybiBjLTE/bzpvW3NbMF1dfWlmKG51bGw9PWkmJnQuaXMocixcImFycmF5XCIpKXtmb3Iobz17fSxsPTAsYz1yLmxlbmd0aDtjPmw7bCsrKW9bcltsXV09dGhpcy5hdHRyKHJbbF0pO3JldHVybiBvfWlmKG51bGwhPWkpe3ZhciBmPXt9O2Zbcl09aX1lbHNlIG51bGwhPXImJnQuaXMocixcIm9iamVjdFwiKSYmKGY9cik7Zm9yKHZhciBwIGluIGYpdShcInJhcGhhZWwuYXR0ci5cIitwK1wiLlwiK3RoaXMuaWQsdGhpcyxmW3BdKTtmb3IocCBpbiB0aGlzLnBhcGVyLmN1c3RvbUF0dHJpYnV0ZXMpaWYodGhpcy5wYXBlci5jdXN0b21BdHRyaWJ1dGVzW2VdKHApJiZmW2VdKHApJiZ0LmlzKHRoaXMucGFwZXIuY3VzdG9tQXR0cmlidXRlc1twXSxcImZ1bmN0aW9uXCIpKXt2YXIgZD10aGlzLnBhcGVyLmN1c3RvbUF0dHJpYnV0ZXNbcF0uYXBwbHkodGhpcyxbXS5jb25jYXQoZltwXSkpO3RoaXMuYXR0cnNbcF09ZltwXTtmb3IodmFyIGcgaW4gZClkW2VdKGcpJiYoZltnXT1kW2ddKX1yZXR1cm4gQih0aGlzLGYpLHRoaXN9LEUudG9Gcm9udD1mdW5jdGlvbigpe2lmKHRoaXMucmVtb3ZlZClyZXR1cm4gdGhpczt2YXIgZT1UKHRoaXMubm9kZSk7ZS5wYXJlbnROb2RlLmFwcGVuZENoaWxkKGUpO3ZhciByPXRoaXMucGFwZXI7cmV0dXJuIHIudG9wIT10aGlzJiZ0Ll90b2Zyb250KHRoaXMsciksdGhpc30sRS50b0JhY2s9ZnVuY3Rpb24oKXtpZih0aGlzLnJlbW92ZWQpcmV0dXJuIHRoaXM7dmFyIGU9VCh0aGlzLm5vZGUpLHI9ZS5wYXJlbnROb2RlO3IuaW5zZXJ0QmVmb3JlKGUsci5maXJzdENoaWxkKSx0Ll90b2JhY2sodGhpcyx0aGlzLnBhcGVyKTt2YXIgaT10aGlzLnBhcGVyO3JldHVybiB0aGlzfSxFLmluc2VydEFmdGVyPWZ1bmN0aW9uKGUpe2lmKHRoaXMucmVtb3ZlZHx8IWUpcmV0dXJuIHRoaXM7dmFyIHI9VCh0aGlzLm5vZGUpLGk9VChlLm5vZGV8fGVbZS5sZW5ndGgtMV0ubm9kZSk7cmV0dXJuIGkubmV4dFNpYmxpbmc/aS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyLGkubmV4dFNpYmxpbmcpOmkucGFyZW50Tm9kZS5hcHBlbmRDaGlsZChyKSx0Ll9pbnNlcnRhZnRlcih0aGlzLGUsdGhpcy5wYXBlciksdGhpc30sRS5pbnNlcnRCZWZvcmU9ZnVuY3Rpb24oZSl7aWYodGhpcy5yZW1vdmVkfHwhZSlyZXR1cm4gdGhpczt2YXIgcj1UKHRoaXMubm9kZSksaT1UKGUubm9kZXx8ZVswXS5ub2RlKTtyZXR1cm4gaS5wYXJlbnROb2RlLmluc2VydEJlZm9yZShyLGkpLHQuX2luc2VydGJlZm9yZSh0aGlzLGUsdGhpcy5wYXBlciksdGhpc30sRS5ibHVyPWZ1bmN0aW9uKGUpe3ZhciByPXRoaXM7aWYoMCE9PStlKXt2YXIgaT14KFwiZmlsdGVyXCIpLG49eChcImZlR2F1c3NpYW5CbHVyXCIpO3IuYXR0cnMuYmx1cj1lLGkuaWQ9dC5jcmVhdGVVVUlEKCkseChuLHtzdGREZXZpYXRpb246K2V8fDEuNX0pLGkuYXBwZW5kQ2hpbGQobiksci5wYXBlci5kZWZzLmFwcGVuZENoaWxkKGkpLHIuX2JsdXI9aSx4KHIubm9kZSx7ZmlsdGVyOlwidXJsKCNcIitpLmlkK1wiKVwifSl9ZWxzZSByLl9ibHVyJiYoci5fYmx1ci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHIuX2JsdXIpLGRlbGV0ZSByLl9ibHVyLGRlbGV0ZSByLmF0dHJzLmJsdXIpLHIubm9kZS5yZW1vdmVBdHRyaWJ1dGUoXCJmaWx0ZXJcIik7cmV0dXJuIHJ9LHQuX2VuZ2luZS5jaXJjbGU9ZnVuY3Rpb24odCxlLHIsaSl7dmFyIG49eChcImNpcmNsZVwiKTt0LmNhbnZhcyYmdC5jYW52YXMuYXBwZW5kQ2hpbGQobik7dmFyIGE9bmV3IEEobix0KTtyZXR1cm4gYS5hdHRycz17Y3g6ZSxjeTpyLHI6aSxmaWxsOlwibm9uZVwiLHN0cm9rZTpcIiMwMDBcIn0sYS50eXBlPVwiY2lyY2xlXCIseChuLGEuYXR0cnMpLGF9LHQuX2VuZ2luZS5yZWN0PWZ1bmN0aW9uKHQsZSxyLGksbixhKXt2YXIgcz14KFwicmVjdFwiKTt0LmNhbnZhcyYmdC5jYW52YXMuYXBwZW5kQ2hpbGQocyk7dmFyIG89bmV3IEEocyx0KTtyZXR1cm4gby5hdHRycz17eDplLHk6cix3aWR0aDppLGhlaWdodDpuLHJ4OmF8fDAscnk6YXx8MCxmaWxsOlwibm9uZVwiLHN0cm9rZTpcIiMwMDBcIn0sby50eXBlPVwicmVjdFwiLHgocyxvLmF0dHJzKSxvfSx0Ll9lbmdpbmUuZWxsaXBzZT1mdW5jdGlvbih0LGUscixpLG4pe3ZhciBhPXgoXCJlbGxpcHNlXCIpO3QuY2FudmFzJiZ0LmNhbnZhcy5hcHBlbmRDaGlsZChhKTt2YXIgcz1uZXcgQShhLHQpO3JldHVybiBzLmF0dHJzPXtjeDplLGN5OnIscng6aSxyeTpuLGZpbGw6XCJub25lXCIsc3Ryb2tlOlwiIzAwMFwifSxzLnR5cGU9XCJlbGxpcHNlXCIseChhLHMuYXR0cnMpLHN9LHQuX2VuZ2luZS5pbWFnZT1mdW5jdGlvbih0LGUscixpLG4sYSl7dmFyIHM9eChcImltYWdlXCIpO3gocyx7eDpyLHk6aSx3aWR0aDpuLGhlaWdodDphLHByZXNlcnZlQXNwZWN0UmF0aW86XCJub25lXCJ9KSxzLnNldEF0dHJpYnV0ZU5TKHAsXCJocmVmXCIsZSksdC5jYW52YXMmJnQuY2FudmFzLmFwcGVuZENoaWxkKHMpO3ZhciBvPW5ldyBBKHMsdCk7cmV0dXJuIG8uYXR0cnM9e3g6cix5Omksd2lkdGg6bixoZWlnaHQ6YSxzcmM6ZX0sby50eXBlPVwiaW1hZ2VcIixvfSx0Ll9lbmdpbmUudGV4dD1mdW5jdGlvbihlLHIsaSxuKXt2YXIgYT14KFwidGV4dFwiKTtlLmNhbnZhcyYmZS5jYW52YXMuYXBwZW5kQ2hpbGQoYSk7dmFyIHM9bmV3IEEoYSxlKTtyZXR1cm4gcy5hdHRycz17eDpyLHk6aSxcInRleHQtYW5jaG9yXCI6XCJtaWRkbGVcIix0ZXh0Om4sXCJmb250LWZhbWlseVwiOnQuX2F2YWlsYWJsZUF0dHJzW1wiZm9udC1mYW1pbHlcIl0sXCJmb250LXNpemVcIjp0Ll9hdmFpbGFibGVBdHRyc1tcImZvbnQtc2l6ZVwiXSxzdHJva2U6XCJub25lXCIsZmlsbDpcIiMwMDBcIn0scy50eXBlPVwidGV4dFwiLEIocyxzLmF0dHJzKSxzfSx0Ll9lbmdpbmUuc2V0U2l6ZT1mdW5jdGlvbih0LGUpe3JldHVybiB0aGlzLndpZHRoPXR8fHRoaXMud2lkdGgsdGhpcy5oZWlnaHQ9ZXx8dGhpcy5oZWlnaHQsdGhpcy5jYW52YXMuc2V0QXR0cmlidXRlKFwid2lkdGhcIix0aGlzLndpZHRoKSx0aGlzLmNhbnZhcy5zZXRBdHRyaWJ1dGUoXCJoZWlnaHRcIix0aGlzLmhlaWdodCksdGhpcy5fdmlld0JveCYmdGhpcy5zZXRWaWV3Qm94LmFwcGx5KHRoaXMsdGhpcy5fdmlld0JveCksdGhpc30sdC5fZW5naW5lLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPXQuX2dldENvbnRhaW5lci5hcHBseSgwLGFyZ3VtZW50cykscj1lJiZlLmNvbnRhaW5lcixpPWUueCxuPWUueSxhPWUud2lkdGgscz1lLmhlaWdodDtpZighcil0aHJvdyBuZXcgRXJyb3IoXCJTVkcgY29udGFpbmVyIG5vdCBmb3VuZC5cIik7dmFyIG89eChcInN2Z1wiKSxsPVwib3ZlcmZsb3c6aGlkZGVuO1wiLGg7cmV0dXJuIGk9aXx8MCxuPW58fDAsYT1hfHw1MTIscz1zfHwzNDIseChvLHtoZWlnaHQ6cyx2ZXJzaW9uOjEuMSx3aWR0aDphLHhtbG5zOlwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIixcInhtbG5zOnhsaW5rXCI6XCJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rXCJ9KSwxPT1yPyhvLnN0eWxlLmNzc1RleHQ9bCtcInBvc2l0aW9uOmFic29sdXRlO2xlZnQ6XCIraStcInB4O3RvcDpcIituK1wicHhcIix0Ll9nLmRvYy5ib2R5LmFwcGVuZENoaWxkKG8pLGg9MSk6KG8uc3R5bGUuY3NzVGV4dD1sK1wicG9zaXRpb246cmVsYXRpdmVcIixyLmZpcnN0Q2hpbGQ/ci5pbnNlcnRCZWZvcmUobyxyLmZpcnN0Q2hpbGQpOnIuYXBwZW5kQ2hpbGQobykpLHI9bmV3IHQuX1BhcGVyLHIud2lkdGg9YSxyLmhlaWdodD1zLHIuY2FudmFzPW8sci5jbGVhcigpLHIuX2xlZnQ9ci5fdG9wPTAsaCYmKHIucmVuZGVyZml4PWZ1bmN0aW9uKCl7fSksci5yZW5kZXJmaXgoKSxyfSx0Ll9lbmdpbmUuc2V0Vmlld0JveD1mdW5jdGlvbih0LGUscixpLG4pe3UoXCJyYXBoYWVsLnNldFZpZXdCb3hcIix0aGlzLHRoaXMuX3ZpZXdCb3gsW3QsZSxyLGksbl0pO3ZhciBhPXRoaXMuZ2V0U2l6ZSgpLG89cyhyL2Eud2lkdGgsaS9hLmhlaWdodCksbD10aGlzLnRvcCxoPW4/XCJ4TWlkWU1pZCBtZWV0XCI6XCJ4TWluWU1pblwiLGMscDtmb3IobnVsbD09dD8odGhpcy5fdmJTaXplJiYobz0xKSxkZWxldGUgdGhpcy5fdmJTaXplLGM9XCIwIDAgXCIrdGhpcy53aWR0aCtmK3RoaXMuaGVpZ2h0KToodGhpcy5fdmJTaXplPW8sYz10K2YrZStmK3IrZitpKSx4KHRoaXMuY2FudmFzLHt2aWV3Qm94OmMscHJlc2VydmVBc3BlY3RSYXRpbzpofSk7byYmbDspcD1cInN0cm9rZS13aWR0aFwiaW4gbC5hdHRycz9sLmF0dHJzW1wic3Ryb2tlLXdpZHRoXCJdOjEsbC5hdHRyKHtcInN0cm9rZS13aWR0aFwiOnB9KSxsLl8uZGlydHk9MSxsLl8uZGlydHlUPTEsbD1sLnByZXY7cmV0dXJuIHRoaXMuX3ZpZXdCb3g9W3QsZSxyLGksISFuXSx0aGlzfSx0LnByb3RvdHlwZS5yZW5kZXJmaXg9ZnVuY3Rpb24oKXt2YXIgdD10aGlzLmNhbnZhcyxlPXQuc3R5bGUscjt0cnl7cj10LmdldFNjcmVlbkNUTSgpfHx0LmNyZWF0ZVNWR01hdHJpeCgpfWNhdGNoKGkpe3I9dC5jcmVhdGVTVkdNYXRyaXgoKX12YXIgbj0tci5lJTEsYT0tci5mJTE7KG58fGEpJiYobiYmKHRoaXMuX2xlZnQ9KHRoaXMuX2xlZnQrbiklMSxlLmxlZnQ9dGhpcy5fbGVmdCtcInB4XCIpLGEmJih0aGlzLl90b3A9KHRoaXMuX3RvcCthKSUxLGUudG9wPXRoaXMuX3RvcCtcInB4XCIpKX0sdC5wcm90b3R5cGUuY2xlYXI9ZnVuY3Rpb24oKXt0LmV2ZShcInJhcGhhZWwuY2xlYXJcIix0aGlzKTtmb3IodmFyIGU9dGhpcy5jYW52YXM7ZS5maXJzdENoaWxkOyllLnJlbW92ZUNoaWxkKGUuZmlyc3RDaGlsZCk7dGhpcy5ib3R0b209dGhpcy50b3A9bnVsbCwodGhpcy5kZXNjPXgoXCJkZXNjXCIpKS5hcHBlbmRDaGlsZCh0Ll9nLmRvYy5jcmVhdGVUZXh0Tm9kZShcIkNyZWF0ZWQgd2l0aCBSYXBoYcOrbCBcIit0LnZlcnNpb24pKSxlLmFwcGVuZENoaWxkKHRoaXMuZGVzYyksZS5hcHBlbmRDaGlsZCh0aGlzLmRlZnM9eChcImRlZnNcIikpfSx0LnByb3RvdHlwZS5yZW1vdmU9ZnVuY3Rpb24oKXt1KFwicmFwaGFlbC5yZW1vdmVcIix0aGlzKSx0aGlzLmNhbnZhcy5wYXJlbnROb2RlJiZ0aGlzLmNhbnZhcy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuY2FudmFzKTtmb3IodmFyIGUgaW4gdGhpcyl0aGlzW2VdPVwiZnVuY3Rpb25cIj09dHlwZW9mIHRoaXNbZV0/dC5fcmVtb3ZlZEZhY3RvcnkoZSk6bnVsbH07dmFyIE49dC5zdDtmb3IodmFyIE0gaW4gRSlFW2VdKE0pJiYhTltlXShNKSYmKE5bTV09ZnVuY3Rpb24odCl7cmV0dXJuIGZ1bmN0aW9uKCl7dmFyIGU9YXJndW1lbnRzO3JldHVybiB0aGlzLmZvckVhY2goZnVuY3Rpb24ocil7clt0XS5hcHBseShyLGUpfSl9fShNKSl9fS5hcHBseShlLGkpLCEodm9pZCAwIT09biYmKHQuZXhwb3J0cz1uKSl9LGZ1bmN0aW9uKHQsZSxyKXt2YXIgaSxuO2k9W3IoMSldLG49ZnVuY3Rpb24odCl7aWYoIXR8fHQudm1sKXt2YXIgZT1cImhhc093blByb3BlcnR5XCIscj1TdHJpbmcsaT1wYXJzZUZsb2F0LG49TWF0aCxhPW4ucm91bmQscz1uLm1heCxvPW4ubWluLGw9bi5hYnMsaD1cImZpbGxcIix1PS9bLCBdKy8sYz10LmV2ZSxmPVwiIHByb2dpZDpEWEltYWdlVHJhbnNmb3JtLk1pY3Jvc29mdFwiLHA9XCIgXCIsZD1cIlwiLGc9e006XCJtXCIsTDpcImxcIixDOlwiY1wiLFo6XCJ4XCIsbTpcInRcIixsOlwiclwiLGM6XCJ2XCIsejpcInhcIn0seD0vKFtjbG16XSksPyhbXmNsbXpdKikvZ2ksdj0vIHByb2dpZDpcXFMrQmx1clxcKFteXFwpXStcXCkvZyx5PS8tP1teLFxccy1dKy9nLG09XCJwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7dG9wOjA7d2lkdGg6MXB4O2hlaWdodDoxcHg7YmVoYXZpb3I6dXJsKCNkZWZhdWx0I1ZNTClcIixiPTIxNjAwLF89e3BhdGg6MSxyZWN0OjEsaW1hZ2U6MX0sdz17Y2lyY2xlOjEsZWxsaXBzZToxfSxrPWZ1bmN0aW9uKGUpe3ZhciBpPS9bYWhxc3R2XS9naSxuPXQuX3BhdGhUb0Fic29sdXRlO2lmKHIoZSkubWF0Y2goaSkmJihuPXQuX3BhdGgyY3VydmUpLGk9L1tjbG16XS9nLG49PXQuX3BhdGhUb0Fic29sdXRlJiYhcihlKS5tYXRjaChpKSl7dmFyIHM9cihlKS5yZXBsYWNlKHgsZnVuY3Rpb24odCxlLHIpe3ZhciBpPVtdLG49XCJtXCI9PWUudG9Mb3dlckNhc2UoKSxzPWdbZV07cmV0dXJuIHIucmVwbGFjZSh5LGZ1bmN0aW9uKHQpe24mJjI9PWkubGVuZ3RoJiYocys9aStnW1wibVwiPT1lP1wibFwiOlwiTFwiXSxpPVtdKSxpLnB1c2goYSh0KmIpKX0pLHMraX0pO3JldHVybiBzfXZhciBvPW4oZSksbCxoO3M9W107Zm9yKHZhciB1PTAsYz1vLmxlbmd0aDtjPnU7dSsrKXtsPW9bdV0saD1vW3VdWzBdLnRvTG93ZXJDYXNlKCksXCJ6XCI9PWgmJihoPVwieFwiKTtmb3IodmFyIGY9MSx2PWwubGVuZ3RoO3Y+ZjtmKyspaCs9YShsW2ZdKmIpKyhmIT12LTE/XCIsXCI6ZCk7cy5wdXNoKGgpfXJldHVybiBzLmpvaW4ocCl9LEI9ZnVuY3Rpb24oZSxyLGkpe3ZhciBuPXQubWF0cml4KCk7cmV0dXJuIG4ucm90YXRlKC1lLC41LC41KSx7ZHg6bi54KHIsaSksZHk6bi55KHIsaSl9fSxDPWZ1bmN0aW9uKHQsZSxyLGksbixhKXt2YXIgcz10Ll8sbz10Lm1hdHJpeCx1PXMuZmlsbHBvcyxjPXQubm9kZSxmPWMuc3R5bGUsZD0xLGc9XCJcIix4LHY9Yi9lLHk9Yi9yO2lmKGYudmlzaWJpbGl0eT1cImhpZGRlblwiLGUmJnIpe2lmKGMuY29vcmRzaXplPWwodikrcCtsKHkpLGYucm90YXRpb249YSooMD5lKnI/LTE6MSksYSl7dmFyIG09QihhLGksbik7aT1tLmR4LG49bS5keX1pZigwPmUmJihnKz1cInhcIiksMD5yJiYoZys9XCIgeVwiKSYmKGQ9LTEpLGYuZmxpcD1nLGMuY29vcmRvcmlnaW49aSotditwK24qLXksdXx8cy5maWxsc2l6ZSl7dmFyIF89Yy5nZXRFbGVtZW50c0J5VGFnTmFtZShoKTtfPV8mJl9bMF0sYy5yZW1vdmVDaGlsZChfKSx1JiYobT1CKGEsby54KHVbMF0sdVsxXSksby55KHVbMF0sdVsxXSkpLF8ucG9zaXRpb249bS5keCpkK3ArbS5keSpkKSxzLmZpbGxzaXplJiYoXy5zaXplPXMuZmlsbHNpemVbMF0qbChlKStwK3MuZmlsbHNpemVbMV0qbChyKSksYy5hcHBlbmRDaGlsZChfKX1mLnZpc2liaWxpdHk9XCJ2aXNpYmxlXCJ9fTt0LnRvU3RyaW5nPWZ1bmN0aW9uKCl7cmV0dXJuXCJZb3VyIGJyb3dzZXIgZG9lc27igJl0IHN1cHBvcnQgU1ZHLiBGYWxsaW5nIGRvd24gdG8gVk1MLlxcbllvdSBhcmUgcnVubmluZyBSYXBoYcOrbCBcIit0aGlzLnZlcnNpb259O3ZhciBTPWZ1bmN0aW9uKHQsZSxpKXtmb3IodmFyIG49cihlKS50b0xvd2VyQ2FzZSgpLnNwbGl0KFwiLVwiKSxhPWk/XCJlbmRcIjpcInN0YXJ0XCIscz1uLmxlbmd0aCxvPVwiY2xhc3NpY1wiLGw9XCJtZWRpdW1cIixoPVwibWVkaXVtXCI7cy0tOylzd2l0Y2gobltzXSl7Y2FzZVwiYmxvY2tcIjpjYXNlXCJjbGFzc2ljXCI6Y2FzZVwib3ZhbFwiOmNhc2VcImRpYW1vbmRcIjpjYXNlXCJvcGVuXCI6Y2FzZVwibm9uZVwiOm89bltzXTticmVhaztjYXNlXCJ3aWRlXCI6Y2FzZVwibmFycm93XCI6aD1uW3NdO2JyZWFrO2Nhc2VcImxvbmdcIjpjYXNlXCJzaG9ydFwiOmw9bltzXX12YXIgdT10Lm5vZGUuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJzdHJva2VcIilbMF07dVthK1wiYXJyb3dcIl09byx1W2ErXCJhcnJvd2xlbmd0aFwiXT1sLHVbYStcImFycm93d2lkdGhcIl09aH0sVD1mdW5jdGlvbihuLGwpe24uYXR0cnM9bi5hdHRyc3x8e307dmFyIGM9bi5ub2RlLGY9bi5hdHRycyxnPWMuc3R5bGUseCx2PV9bbi50eXBlXSYmKGwueCE9Zi54fHxsLnkhPWYueXx8bC53aWR0aCE9Zi53aWR0aHx8bC5oZWlnaHQhPWYuaGVpZ2h0fHxsLmN4IT1mLmN4fHxsLmN5IT1mLmN5fHxsLnJ4IT1mLnJ4fHxsLnJ5IT1mLnJ5fHxsLnIhPWYucikseT13W24udHlwZV0mJihmLmN4IT1sLmN4fHxmLmN5IT1sLmN5fHxmLnIhPWwucnx8Zi5yeCE9bC5yeHx8Zi5yeSE9bC5yeSksbT1uO2Zvcih2YXIgQiBpbiBsKWxbZV0oQikmJihmW0JdPWxbQl0pO2lmKHYmJihmLnBhdGg9dC5fZ2V0UGF0aFtuLnR5cGVdKG4pLG4uXy5kaXJ0eT0xKSxsLmhyZWYmJihjLmhyZWY9bC5ocmVmKSxsLnRpdGxlJiYoYy50aXRsZT1sLnRpdGxlKSxsLnRhcmdldCYmKGMudGFyZ2V0PWwudGFyZ2V0KSxsLmN1cnNvciYmKGcuY3Vyc29yPWwuY3Vyc29yKSxcImJsdXJcImluIGwmJm4uYmx1cihsLmJsdXIpLChsLnBhdGgmJlwicGF0aFwiPT1uLnR5cGV8fHYpJiYoYy5wYXRoPWsofnIoZi5wYXRoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2YoXCJyXCIpP3QuX3BhdGhUb0Fic29sdXRlKGYucGF0aCk6Zi5wYXRoKSxuLl8uZGlydHk9MSxcImltYWdlXCI9PW4udHlwZSYmKG4uXy5maWxscG9zPVtmLngsZi55XSxuLl8uZmlsbHNpemU9W2Yud2lkdGgsZi5oZWlnaHRdLEMobiwxLDEsMCwwLDApKSksXCJ0cmFuc2Zvcm1cImluIGwmJm4udHJhbnNmb3JtKGwudHJhbnNmb3JtKSx5KXt2YXIgVD0rZi5jeCxFPStmLmN5LE49K2Yucnh8fCtmLnJ8fDAsTD0rZi5yeXx8K2Yucnx8MDtjLnBhdGg9dC5mb3JtYXQoXCJhcnswfSx7MX0sezJ9LHszfSx7NH0sezF9LHs0fSx7MX14XCIsYSgoVC1OKSpiKSxhKChFLUwpKmIpLGEoKFQrTikqYiksYSgoRStMKSpiKSxhKFQqYikpLG4uXy5kaXJ0eT0xfWlmKFwiY2xpcC1yZWN0XCJpbiBsKXt2YXIgej1yKGxbXCJjbGlwLXJlY3RcIl0pLnNwbGl0KHUpO2lmKDQ9PXoubGVuZ3RoKXt6WzJdPSt6WzJdKyArelswXSx6WzNdPSt6WzNdKyArelsxXTt2YXIgUD1jLmNsaXBSZWN0fHx0Ll9nLmRvYy5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLEY9UC5zdHlsZTtGLmNsaXA9dC5mb3JtYXQoXCJyZWN0KHsxfXB4IHsyfXB4IHszfXB4IHswfXB4KVwiLHopLGMuY2xpcFJlY3R8fChGLnBvc2l0aW9uPVwiYWJzb2x1dGVcIixGLnRvcD0wLEYubGVmdD0wLEYud2lkdGg9bi5wYXBlci53aWR0aCtcInB4XCIsRi5oZWlnaHQ9bi5wYXBlci5oZWlnaHQrXCJweFwiLGMucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUoUCxjKSxQLmFwcGVuZENoaWxkKGMpLGMuY2xpcFJlY3Q9UCl9bFtcImNsaXAtcmVjdFwiXXx8Yy5jbGlwUmVjdCYmKGMuY2xpcFJlY3Quc3R5bGUuY2xpcD1cImF1dG9cIil9aWYobi50ZXh0cGF0aCl7dmFyIFI9bi50ZXh0cGF0aC5zdHlsZTtsLmZvbnQmJihSLmZvbnQ9bC5mb250KSxsW1wiZm9udC1mYW1pbHlcIl0mJihSLmZvbnRGYW1pbHk9J1wiJytsW1wiZm9udC1mYW1pbHlcIl0uc3BsaXQoXCIsXCIpWzBdLnJlcGxhY2UoL15bJ1wiXSt8WydcIl0rJC9nLGQpKydcIicpLGxbXCJmb250LXNpemVcIl0mJihSLmZvbnRTaXplPWxbXCJmb250LXNpemVcIl0pLGxbXCJmb250LXdlaWdodFwiXSYmKFIuZm9udFdlaWdodD1sW1wiZm9udC13ZWlnaHRcIl0pLGxbXCJmb250LXN0eWxlXCJdJiYoUi5mb250U3R5bGU9bFtcImZvbnQtc3R5bGVcIl0pfWlmKFwiYXJyb3ctc3RhcnRcImluIGwmJlMobSxsW1wiYXJyb3ctc3RhcnRcIl0pLFwiYXJyb3ctZW5kXCJpbiBsJiZTKG0sbFtcImFycm93LWVuZFwiXSwxKSxudWxsIT1sLm9wYWNpdHl8fG51bGwhPWwuZmlsbHx8bnVsbCE9bC5zcmN8fG51bGwhPWwuc3Ryb2tlfHxudWxsIT1sW1wic3Ryb2tlLXdpZHRoXCJdfHxudWxsIT1sW1wic3Ryb2tlLW9wYWNpdHlcIl18fG51bGwhPWxbXCJmaWxsLW9wYWNpdHlcIl18fG51bGwhPWxbXCJzdHJva2UtZGFzaGFycmF5XCJdfHxudWxsIT1sW1wic3Ryb2tlLW1pdGVybGltaXRcIl18fG51bGwhPWxbXCJzdHJva2UtbGluZWpvaW5cIl18fG51bGwhPWxbXCJzdHJva2UtbGluZWNhcFwiXSl7dmFyIEk9Yy5nZXRFbGVtZW50c0J5VGFnTmFtZShoKSxqPSExO2lmKEk9SSYmSVswXSwhSSYmKGo9ST1NKGgpKSxcImltYWdlXCI9PW4udHlwZSYmbC5zcmMmJihJLnNyYz1sLnNyYyksbC5maWxsJiYoSS5vbj0hMCksbnVsbCE9SS5vbiYmXCJub25lXCIhPWwuZmlsbCYmbnVsbCE9PWwuZmlsbHx8KEkub249ITEpLEkub24mJmwuZmlsbCl7dmFyIHE9cihsLmZpbGwpLm1hdGNoKHQuX0lTVVJMKTtpZihxKXtJLnBhcmVudE5vZGU9PWMmJmMucmVtb3ZlQ2hpbGQoSSksSS5yb3RhdGU9ITAsSS5zcmM9cVsxXSxJLnR5cGU9XCJ0aWxlXCI7dmFyIEQ9bi5nZXRCQm94KDEpO0kucG9zaXRpb249RC54K3ArRC55LG4uXy5maWxscG9zPVtELngsRC55XSx0Ll9wcmVsb2FkKHFbMV0sZnVuY3Rpb24oKXtuLl8uZmlsbHNpemU9W3RoaXMub2Zmc2V0V2lkdGgsdGhpcy5vZmZzZXRIZWlnaHRdfSl9ZWxzZSBJLmNvbG9yPXQuZ2V0UkdCKGwuZmlsbCkuaGV4LEkuc3JjPWQsSS50eXBlPVwic29saWRcIix0LmdldFJHQihsLmZpbGwpLmVycm9yJiYobS50eXBlIGlue2NpcmNsZToxLGVsbGlwc2U6MX18fFwiclwiIT1yKGwuZmlsbCkuY2hhckF0KCkpJiZBKG0sbC5maWxsLEkpJiYoZi5maWxsPVwibm9uZVwiLGYuZ3JhZGllbnQ9bC5maWxsLEkucm90YXRlPSExKX1pZihcImZpbGwtb3BhY2l0eVwiaW4gbHx8XCJvcGFjaXR5XCJpbiBsKXt2YXIgVj0oKCtmW1wiZmlsbC1vcGFjaXR5XCJdKzF8fDIpLTEpKigoK2Yub3BhY2l0eSsxfHwyKS0xKSooKCt0LmdldFJHQihsLmZpbGwpLm8rMXx8MiktMSk7Vj1vKHMoViwwKSwxKSxJLm9wYWNpdHk9VixJLnNyYyYmKEkuY29sb3I9XCJub25lXCIpfWMuYXBwZW5kQ2hpbGQoSSk7dmFyIE89Yy5nZXRFbGVtZW50c0J5VGFnTmFtZShcInN0cm9rZVwiKSYmYy5nZXRFbGVtZW50c0J5VGFnTmFtZShcInN0cm9rZVwiKVswXSxZPSExOyFPJiYoWT1PPU0oXCJzdHJva2VcIikpLChsLnN0cm9rZSYmXCJub25lXCIhPWwuc3Ryb2tlfHxsW1wic3Ryb2tlLXdpZHRoXCJdfHxudWxsIT1sW1wic3Ryb2tlLW9wYWNpdHlcIl18fGxbXCJzdHJva2UtZGFzaGFycmF5XCJdfHxsW1wic3Ryb2tlLW1pdGVybGltaXRcIl18fGxbXCJzdHJva2UtbGluZWpvaW5cIl18fGxbXCJzdHJva2UtbGluZWNhcFwiXSkmJihPLm9uPSEwKSwoXCJub25lXCI9PWwuc3Ryb2tlfHxudWxsPT09bC5zdHJva2V8fG51bGw9PU8ub258fDA9PWwuc3Ryb2tlfHwwPT1sW1wic3Ryb2tlLXdpZHRoXCJdKSYmKE8ub249ITEpO3ZhciBXPXQuZ2V0UkdCKGwuc3Ryb2tlKTtPLm9uJiZsLnN0cm9rZSYmKE8uY29sb3I9Vy5oZXgpLFY9KCgrZltcInN0cm9rZS1vcGFjaXR5XCJdKzF8fDIpLTEpKigoK2Yub3BhY2l0eSsxfHwyKS0xKSooKCtXLm8rMXx8MiktMSk7dmFyIEc9Ljc1KihpKGxbXCJzdHJva2Utd2lkdGhcIl0pfHwxKTtpZihWPW8ocyhWLDApLDEpLG51bGw9PWxbXCJzdHJva2Utd2lkdGhcIl0mJihHPWZbXCJzdHJva2Utd2lkdGhcIl0pLGxbXCJzdHJva2Utd2lkdGhcIl0mJihPLndlaWdodD1HKSxHJiYxPkcmJihWKj1HKSYmKE8ud2VpZ2h0PTEpLE8ub3BhY2l0eT1WLGxbXCJzdHJva2UtbGluZWpvaW5cIl0mJihPLmpvaW5zdHlsZT1sW1wic3Ryb2tlLWxpbmVqb2luXCJdfHxcIm1pdGVyXCIpLE8ubWl0ZXJsaW1pdD1sW1wic3Ryb2tlLW1pdGVybGltaXRcIl18fDgsbFtcInN0cm9rZS1saW5lY2FwXCJdJiYoTy5lbmRjYXA9XCJidXR0XCI9PWxbXCJzdHJva2UtbGluZWNhcFwiXT9cImZsYXRcIjpcInNxdWFyZVwiPT1sW1wic3Ryb2tlLWxpbmVjYXBcIl0/XCJzcXVhcmVcIjpcInJvdW5kXCIpLFwic3Ryb2tlLWRhc2hhcnJheVwiaW4gbCl7dmFyIEg9e1wiLVwiOlwic2hvcnRkYXNoXCIsXCIuXCI6XCJzaG9ydGRvdFwiLFwiLS5cIjpcInNob3J0ZGFzaGRvdFwiLFwiLS4uXCI6XCJzaG9ydGRhc2hkb3Rkb3RcIixcIi4gXCI6XCJkb3RcIixcIi0gXCI6XCJkYXNoXCIsXCItLVwiOlwibG9uZ2Rhc2hcIixcIi0gLlwiOlwiZGFzaGRvdFwiLFwiLS0uXCI6XCJsb25nZGFzaGRvdFwiLFwiLS0uLlwiOlwibG9uZ2Rhc2hkb3Rkb3RcIn07Ty5kYXNoc3R5bGU9SFtlXShsW1wic3Ryb2tlLWRhc2hhcnJheVwiXSk/SFtsW1wic3Ryb2tlLWRhc2hhcnJheVwiXV06ZH1ZJiZjLmFwcGVuZENoaWxkKE8pfWlmKFwidGV4dFwiPT1tLnR5cGUpe20ucGFwZXIuY2FudmFzLnN0eWxlLmRpc3BsYXk9ZDt2YXIgWD1tLnBhcGVyLnNwYW4sVT0xMDAsJD1mLmZvbnQmJmYuZm9udC5tYXRjaCgvXFxkKyg/OlxcLlxcZCopPyg/PXB4KS8pO2c9WC5zdHlsZSxmLmZvbnQmJihnLmZvbnQ9Zi5mb250KSxmW1wiZm9udC1mYW1pbHlcIl0mJihnLmZvbnRGYW1pbHk9ZltcImZvbnQtZmFtaWx5XCJdKSxmW1wiZm9udC13ZWlnaHRcIl0mJihnLmZvbnRXZWlnaHQ9ZltcImZvbnQtd2VpZ2h0XCJdKSxmW1wiZm9udC1zdHlsZVwiXSYmKGcuZm9udFN0eWxlPWZbXCJmb250LXN0eWxlXCJdKSwkPWkoZltcImZvbnQtc2l6ZVwiXXx8JCYmJFswXSl8fDEwLGcuZm9udFNpemU9JCpVK1wicHhcIixtLnRleHRwYXRoLnN0cmluZyYmKFguaW5uZXJIVE1MPXIobS50ZXh0cGF0aC5zdHJpbmcpLnJlcGxhY2UoLzwvZyxcIiYjNjA7XCIpLnJlcGxhY2UoLyYvZyxcIiYjMzg7XCIpLnJlcGxhY2UoL1xcbi9nLFwiPGJyPlwiKSk7dmFyIFo9WC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTttLlc9Zi53PShaLnJpZ2h0LVoubGVmdCkvVSxtLkg9Zi5oPShaLmJvdHRvbS1aLnRvcCkvVSxtLlg9Zi54LG0uWT1mLnkrbS5ILzIsKFwieFwiaW4gbHx8XCJ5XCJpbiBsKSYmKG0ucGF0aC52PXQuZm9ybWF0KFwibXswfSx7MX1sezJ9LHsxfVwiLGEoZi54KmIpLGEoZi55KmIpLGEoZi54KmIpKzEpKTtmb3IodmFyIFE9W1wieFwiLFwieVwiLFwidGV4dFwiLFwiZm9udFwiLFwiZm9udC1mYW1pbHlcIixcImZvbnQtd2VpZ2h0XCIsXCJmb250LXN0eWxlXCIsXCJmb250LXNpemVcIl0sSj0wLEs9US5sZW5ndGg7Sz5KO0orKylpZihRW0pdaW4gbCl7bS5fLmRpcnR5PTE7YnJlYWt9c3dpdGNoKGZbXCJ0ZXh0LWFuY2hvclwiXSl7Y2FzZVwic3RhcnRcIjptLnRleHRwYXRoLnN0eWxlW1widi10ZXh0LWFsaWduXCJdPVwibGVmdFwiLG0uYmJ4PW0uVy8yO2JyZWFrO2Nhc2VcImVuZFwiOm0udGV4dHBhdGguc3R5bGVbXCJ2LXRleHQtYWxpZ25cIl09XCJyaWdodFwiLG0uYmJ4PS1tLlcvMjticmVhaztkZWZhdWx0Om0udGV4dHBhdGguc3R5bGVbXCJ2LXRleHQtYWxpZ25cIl09XCJjZW50ZXJcIixtLmJieD0wfW0udGV4dHBhdGguc3R5bGVbXCJ2LXRleHQta2VyblwiXT0hMH19LEE9ZnVuY3Rpb24oZSxhLHMpe2UuYXR0cnM9ZS5hdHRyc3x8e307dmFyIG89ZS5hdHRycyxsPU1hdGgucG93LGgsdSxjPVwibGluZWFyXCIsZj1cIi41IC41XCI7aWYoZS5hdHRycy5ncmFkaWVudD1hLGE9cihhKS5yZXBsYWNlKHQuX3JhZGlhbF9ncmFkaWVudCxmdW5jdGlvbih0LGUscil7cmV0dXJuIGM9XCJyYWRpYWxcIixlJiZyJiYoZT1pKGUpLHI9aShyKSxsKGUtLjUsMikrbChyLS41LDIpPi4yNSYmKHI9bi5zcXJ0KC4yNS1sKGUtLjUsMikpKigyKihyPi41KS0xKSsuNSksZj1lK3ArciksZH0pLGE9YS5zcGxpdCgvXFxzKlxcLVxccyovKSxcImxpbmVhclwiPT1jKXt2YXIgZz1hLnNoaWZ0KCk7aWYoZz0taShnKSxpc05hTihnKSlyZXR1cm4gbnVsbH12YXIgeD10Ll9wYXJzZURvdHMoYSk7aWYoIXgpcmV0dXJuIG51bGw7aWYoZT1lLnNoYXBlfHxlLm5vZGUseC5sZW5ndGgpe2UucmVtb3ZlQ2hpbGQocykscy5vbj0hMCxzLm1ldGhvZD1cIm5vbmVcIixzLmNvbG9yPXhbMF0uY29sb3Iscy5jb2xvcjI9eFt4Lmxlbmd0aC0xXS5jb2xvcjtmb3IodmFyIHY9W10seT0wLG09eC5sZW5ndGg7bT55O3krKyl4W3ldLm9mZnNldCYmdi5wdXNoKHhbeV0ub2Zmc2V0K3AreFt5XS5jb2xvcik7cy5jb2xvcnM9di5sZW5ndGg/di5qb2luKCk6XCIwJSBcIitzLmNvbG9yLFwicmFkaWFsXCI9PWM/KHMudHlwZT1cImdyYWRpZW50VGl0bGVcIixzLmZvY3VzPVwiMTAwJVwiLHMuZm9jdXNzaXplPVwiMCAwXCIscy5mb2N1c3Bvc2l0aW9uPWYscy5hbmdsZT0wKToocy50eXBlPVwiZ3JhZGllbnRcIixzLmFuZ2xlPSgyNzAtZyklMzYwKSxlLmFwcGVuZENoaWxkKHMpfXJldHVybiAxfSxFPWZ1bmN0aW9uKGUscil7dGhpc1swXT10aGlzLm5vZGU9ZSxlLnJhcGhhZWw9ITAsdGhpcy5pZD10Ll9vaWQrKyxlLnJhcGhhZWxpZD10aGlzLmlkLHRoaXMuWD0wLHRoaXMuWT0wLHRoaXMuYXR0cnM9e30sdGhpcy5wYXBlcj1yLHRoaXMubWF0cml4PXQubWF0cml4KCksdGhpcy5fPXt0cmFuc2Zvcm06W10sc3g6MSxzeToxLGR4OjAsZHk6MCxkZWc6MCxkaXJ0eToxLGRpcnR5VDoxfSwhci5ib3R0b20mJihyLmJvdHRvbT10aGlzKSx0aGlzLnByZXY9ci50b3Asci50b3AmJihyLnRvcC5uZXh0PXRoaXMpLHIudG9wPXRoaXMsdGhpcy5uZXh0PW51bGx9LE49dC5lbDtFLnByb3RvdHlwZT1OLE4uY29uc3RydWN0b3I9RSxOLnRyYW5zZm9ybT1mdW5jdGlvbihlKXtpZihudWxsPT1lKXJldHVybiB0aGlzLl8udHJhbnNmb3JtO3ZhciBpPXRoaXMucGFwZXIuX3ZpZXdCb3hTaGlmdCxuPWk/XCJzXCIrW2kuc2NhbGUsaS5zY2FsZV0rXCItMS0xdFwiK1tpLmR4LGkuZHldOmQsYTtpJiYoYT1lPXIoZSkucmVwbGFjZSgvXFwuezN9fFxcdTIwMjYvZyx0aGlzLl8udHJhbnNmb3JtfHxkKSksdC5fZXh0cmFjdFRyYW5zZm9ybSh0aGlzLG4rZSk7dmFyIHM9dGhpcy5tYXRyaXguY2xvbmUoKSxvPXRoaXMuc2tldyxsPXRoaXMubm9kZSxoLHU9fnIodGhpcy5hdHRycy5maWxsKS5pbmRleE9mKFwiLVwiKSxjPSFyKHRoaXMuYXR0cnMuZmlsbCkuaW5kZXhPZihcInVybChcIik7aWYocy50cmFuc2xhdGUoMSwxKSxjfHx1fHxcImltYWdlXCI9PXRoaXMudHlwZSlpZihvLm1hdHJpeD1cIjEgMCAwIDFcIixvLm9mZnNldD1cIjAgMFwiLGg9cy5zcGxpdCgpLHUmJmgubm9Sb3RhdGlvbnx8IWguaXNTaW1wbGUpe2wuc3R5bGUuZmlsdGVyPXMudG9GaWx0ZXIoKTt2YXIgZj10aGlzLmdldEJCb3goKSxnPXRoaXMuZ2V0QkJveCgxKSx4PWYueC1nLngsdj1mLnktZy55O2wuY29vcmRvcmlnaW49eCotYitwK3YqLWIsQyh0aGlzLDEsMSx4LHYsMCl9ZWxzZSBsLnN0eWxlLmZpbHRlcj1kLEModGhpcyxoLnNjYWxleCxoLnNjYWxleSxoLmR4LGguZHksaC5yb3RhdGUpO2Vsc2UgbC5zdHlsZS5maWx0ZXI9ZCxvLm1hdHJpeD1yKHMpLG8ub2Zmc2V0PXMub2Zmc2V0KCk7cmV0dXJuIG51bGwhPT1hJiYodGhpcy5fLnRyYW5zZm9ybT1hLHQuX2V4dHJhY3RUcmFuc2Zvcm0odGhpcyxhKSksdGhpc30sTi5yb3RhdGU9ZnVuY3Rpb24odCxlLG4pe2lmKHRoaXMucmVtb3ZlZClyZXR1cm4gdGhpcztpZihudWxsIT10KXtpZih0PXIodCkuc3BsaXQodSksdC5sZW5ndGgtMSYmKGU9aSh0WzFdKSxuPWkodFsyXSkpLHQ9aSh0WzBdKSxudWxsPT1uJiYoZT1uKSxudWxsPT1lfHxudWxsPT1uKXt2YXIgYT10aGlzLmdldEJCb3goMSk7ZT1hLngrYS53aWR0aC8yLG49YS55K2EuaGVpZ2h0LzJ9cmV0dXJuIHRoaXMuXy5kaXJ0eVQ9MSx0aGlzLnRyYW5zZm9ybSh0aGlzLl8udHJhbnNmb3JtLmNvbmNhdChbW1wiclwiLHQsZSxuXV0pKSx0aGlzfX0sTi50cmFuc2xhdGU9ZnVuY3Rpb24odCxlKXtyZXR1cm4gdGhpcy5yZW1vdmVkP3RoaXM6KHQ9cih0KS5zcGxpdCh1KSx0Lmxlbmd0aC0xJiYoZT1pKHRbMV0pKSx0PWkodFswXSl8fDAsZT0rZXx8MCx0aGlzLl8uYmJveCYmKHRoaXMuXy5iYm94LngrPXQsdGhpcy5fLmJib3gueSs9ZSksdGhpcy50cmFuc2Zvcm0odGhpcy5fLnRyYW5zZm9ybS5jb25jYXQoW1tcInRcIix0LGVdXSkpLHRoaXMpfSxOLnNjYWxlPWZ1bmN0aW9uKHQsZSxuLGEpe2lmKHRoaXMucmVtb3ZlZClyZXR1cm4gdGhpcztpZih0PXIodCkuc3BsaXQodSksdC5sZW5ndGgtMSYmKGU9aSh0WzFdKSxuPWkodFsyXSksYT1pKHRbM10pLGlzTmFOKG4pJiYobj1udWxsKSxpc05hTihhKSYmKGE9bnVsbCkpLHQ9aSh0WzBdKSxudWxsPT1lJiYoZT10KSxudWxsPT1hJiYobj1hKSxudWxsPT1ufHxudWxsPT1hKXZhciBzPXRoaXMuZ2V0QkJveCgxKTtyZXR1cm4gbj1udWxsPT1uP3MueCtzLndpZHRoLzI6bixhPW51bGw9PWE/cy55K3MuaGVpZ2h0LzI6YSx0aGlzLnRyYW5zZm9ybSh0aGlzLl8udHJhbnNmb3JtLmNvbmNhdChbW1wic1wiLHQsZSxuLGFdXSkpLHRoaXMuXy5kaXJ0eVQ9MSx0aGlzfSxOLmhpZGU9ZnVuY3Rpb24oKXtyZXR1cm4hdGhpcy5yZW1vdmVkJiYodGhpcy5ub2RlLnN0eWxlLmRpc3BsYXk9XCJub25lXCIpLHRoaXN9LE4uc2hvdz1mdW5jdGlvbigpe3JldHVybiF0aGlzLnJlbW92ZWQmJih0aGlzLm5vZGUuc3R5bGUuZGlzcGxheT1kKSx0aGlzfSxOLmF1eEdldEJCb3g9dC5lbC5nZXRCQm94LE4uZ2V0QkJveD1mdW5jdGlvbigpe3ZhciB0PXRoaXMuYXV4R2V0QkJveCgpO2lmKHRoaXMucGFwZXImJnRoaXMucGFwZXIuX3ZpZXdCb3hTaGlmdCl7dmFyIGU9e30scj0xL3RoaXMucGFwZXIuX3ZpZXdCb3hTaGlmdC5zY2FsZTtyZXR1cm4gZS54PXQueC10aGlzLnBhcGVyLl92aWV3Qm94U2hpZnQuZHgsZS54Kj1yLGUueT10LnktdGhpcy5wYXBlci5fdmlld0JveFNoaWZ0LmR5LGUueSo9cixlLndpZHRoPXQud2lkdGgqcixlLmhlaWdodD10LmhlaWdodCpyLGUueDI9ZS54K2Uud2lkdGgsZS55Mj1lLnkrZS5oZWlnaHQsZX1yZXR1cm4gdH0sTi5fZ2V0QkJveD1mdW5jdGlvbigpe3JldHVybiB0aGlzLnJlbW92ZWQ/e306e3g6dGhpcy5YKyh0aGlzLmJieHx8MCktdGhpcy5XLzIseTp0aGlzLlktdGhpcy5ILHdpZHRoOnRoaXMuVyxoZWlnaHQ6dGhpcy5IfX0sTi5yZW1vdmU9ZnVuY3Rpb24oKXtpZighdGhpcy5yZW1vdmVkJiZ0aGlzLm5vZGUucGFyZW50Tm9kZSl7dGhpcy5wYXBlci5fX3NldF9fJiZ0aGlzLnBhcGVyLl9fc2V0X18uZXhjbHVkZSh0aGlzKSx0LmV2ZS51bmJpbmQoXCJyYXBoYWVsLiouKi5cIit0aGlzLmlkKSx0Ll90ZWFyKHRoaXMsdGhpcy5wYXBlciksdGhpcy5ub2RlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5ub2RlKSx0aGlzLnNoYXBlJiZ0aGlzLnNoYXBlLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5zaGFwZSk7Zm9yKHZhciBlIGluIHRoaXMpdGhpc1tlXT1cImZ1bmN0aW9uXCI9PXR5cGVvZiB0aGlzW2VdP3QuX3JlbW92ZWRGYWN0b3J5KGUpOm51bGw7dGhpcy5yZW1vdmVkPSEwfX0sTi5hdHRyPWZ1bmN0aW9uKHIsaSl7aWYodGhpcy5yZW1vdmVkKXJldHVybiB0aGlzO2lmKG51bGw9PXIpe3ZhciBuPXt9O2Zvcih2YXIgYSBpbiB0aGlzLmF0dHJzKXRoaXMuYXR0cnNbZV0oYSkmJihuW2FdPXRoaXMuYXR0cnNbYV0pO3JldHVybiBuLmdyYWRpZW50JiZcIm5vbmVcIj09bi5maWxsJiYobi5maWxsPW4uZ3JhZGllbnQpJiZkZWxldGUgbi5ncmFkaWVudCxuLnRyYW5zZm9ybT10aGlzLl8udHJhbnNmb3JtLG59aWYobnVsbD09aSYmdC5pcyhyLFwic3RyaW5nXCIpKXtpZihyPT1oJiZcIm5vbmVcIj09dGhpcy5hdHRycy5maWxsJiZ0aGlzLmF0dHJzLmdyYWRpZW50KXJldHVybiB0aGlzLmF0dHJzLmdyYWRpZW50O2Zvcih2YXIgcz1yLnNwbGl0KHUpLG89e30sbD0wLGY9cy5sZW5ndGg7Zj5sO2wrKylyPXNbbF0sciBpbiB0aGlzLmF0dHJzP29bcl09dGhpcy5hdHRyc1tyXTp0LmlzKHRoaXMucGFwZXIuY3VzdG9tQXR0cmlidXRlc1tyXSxcImZ1bmN0aW9uXCIpP29bcl09dGhpcy5wYXBlci5jdXN0b21BdHRyaWJ1dGVzW3JdLmRlZjpvW3JdPXQuX2F2YWlsYWJsZUF0dHJzW3JdO3JldHVybiBmLTE/bzpvW3NbMF1dfWlmKHRoaXMuYXR0cnMmJm51bGw9PWkmJnQuaXMocixcImFycmF5XCIpKXtmb3Iobz17fSxsPTAsZj1yLmxlbmd0aDtmPmw7bCsrKW9bcltsXV09dGhpcy5hdHRyKHJbbF0pO3JldHVybiBvfXZhciBwO251bGwhPWkmJihwPXt9LHBbcl09aSksbnVsbD09aSYmdC5pcyhyLFwib2JqZWN0XCIpJiYocD1yKTtmb3IodmFyIGQgaW4gcCljKFwicmFwaGFlbC5hdHRyLlwiK2QrXCIuXCIrdGhpcy5pZCx0aGlzLHBbZF0pO2lmKHApe2ZvcihkIGluIHRoaXMucGFwZXIuY3VzdG9tQXR0cmlidXRlcylpZih0aGlzLnBhcGVyLmN1c3RvbUF0dHJpYnV0ZXNbZV0oZCkmJnBbZV0oZCkmJnQuaXModGhpcy5wYXBlci5jdXN0b21BdHRyaWJ1dGVzW2RdLFwiZnVuY3Rpb25cIikpe3ZhciBnPXRoaXMucGFwZXIuY3VzdG9tQXR0cmlidXRlc1tkXS5hcHBseSh0aGlzLFtdLmNvbmNhdChwW2RdKSk7dGhpcy5hdHRyc1tkXT1wW2RdO2Zvcih2YXIgeCBpbiBnKWdbZV0oeCkmJihwW3hdPWdbeF0pfXAudGV4dCYmXCJ0ZXh0XCI9PXRoaXMudHlwZSYmKHRoaXMudGV4dHBhdGguc3RyaW5nPXAudGV4dCksVCh0aGlzLHApfXJldHVybiB0aGlzfSxOLnRvRnJvbnQ9ZnVuY3Rpb24oKXtyZXR1cm4hdGhpcy5yZW1vdmVkJiZ0aGlzLm5vZGUucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzLm5vZGUpLHRoaXMucGFwZXImJnRoaXMucGFwZXIudG9wIT10aGlzJiZ0Ll90b2Zyb250KHRoaXMsdGhpcy5wYXBlciksdGhpc30sTi50b0JhY2s9ZnVuY3Rpb24oKXtyZXR1cm4gdGhpcy5yZW1vdmVkP3RoaXM6KHRoaXMubm9kZS5wYXJlbnROb2RlLmZpcnN0Q2hpbGQhPXRoaXMubm9kZSYmKHRoaXMubm9kZS5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh0aGlzLm5vZGUsdGhpcy5ub2RlLnBhcmVudE5vZGUuZmlyc3RDaGlsZCksdC5fdG9iYWNrKHRoaXMsdGhpcy5wYXBlcikpLHRoaXMpfSxOLmluc2VydEFmdGVyPWZ1bmN0aW9uKGUpe3JldHVybiB0aGlzLnJlbW92ZWQ/dGhpczooZS5jb25zdHJ1Y3Rvcj09dC5zdC5jb25zdHJ1Y3RvciYmKGU9ZVtlLmxlbmd0aC0xXSksZS5ub2RlLm5leHRTaWJsaW5nP2Uubm9kZS5wYXJlbnROb2RlLmluc2VydEJlZm9yZSh0aGlzLm5vZGUsZS5ub2RlLm5leHRTaWJsaW5nKTplLm5vZGUucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzLm5vZGUpLHQuX2luc2VydGFmdGVyKHRoaXMsZSx0aGlzLnBhcGVyKSx0aGlzKX0sTi5pbnNlcnRCZWZvcmU9ZnVuY3Rpb24oZSl7cmV0dXJuIHRoaXMucmVtb3ZlZD90aGlzOihlLmNvbnN0cnVjdG9yPT10LnN0LmNvbnN0cnVjdG9yJiYoZT1lWzBdKSxlLm5vZGUucGFyZW50Tm9kZS5pbnNlcnRCZWZvcmUodGhpcy5ub2RlLGUubm9kZSksdC5faW5zZXJ0YmVmb3JlKHRoaXMsZSx0aGlzLnBhcGVyKSx0aGlzKX0sTi5ibHVyPWZ1bmN0aW9uKGUpe3ZhciByPXRoaXMubm9kZS5ydW50aW1lU3R5bGUsaT1yLmZpbHRlcjtyZXR1cm4gaT1pLnJlcGxhY2UodixkKSwwIT09K2U/KHRoaXMuYXR0cnMuYmx1cj1lLHIuZmlsdGVyPWkrcCtmK1wiLkJsdXIocGl4ZWxyYWRpdXM9XCIrKCtlfHwxLjUpK1wiKVwiLHIubWFyZ2luPXQuZm9ybWF0KFwiLXswfXB4IDAgMCAtezB9cHhcIixhKCtlfHwxLjUpKSk6KHIuZmlsdGVyPWksci5tYXJnaW49MCxkZWxldGUgdGhpcy5hdHRycy5ibHVyKSx0aGlzfSx0Ll9lbmdpbmUucGF0aD1mdW5jdGlvbih0LGUpe3ZhciByPU0oXCJzaGFwZVwiKTtyLnN0eWxlLmNzc1RleHQ9bSxyLmNvb3Jkc2l6ZT1iK3ArYixyLmNvb3Jkb3JpZ2luPWUuY29vcmRvcmlnaW47dmFyIGk9bmV3IEUocixlKSxuPXtmaWxsOlwibm9uZVwiLHN0cm9rZTpcIiMwMDBcIn07dCYmKG4ucGF0aD10KSxpLnR5cGU9XCJwYXRoXCIsaS5wYXRoPVtdLGkuUGF0aD1kLFQoaSxuKSxlLmNhbnZhcyYmZS5jYW52YXMuYXBwZW5kQ2hpbGQocik7dmFyIGE9TShcInNrZXdcIik7cmV0dXJuIGEub249ITAsci5hcHBlbmRDaGlsZChhKSxpLnNrZXc9YSxpLnRyYW5zZm9ybShkKSxpfSx0Ll9lbmdpbmUucmVjdD1mdW5jdGlvbihlLHIsaSxuLGEscyl7dmFyIG89dC5fcmVjdFBhdGgocixpLG4sYSxzKSxsPWUucGF0aChvKSxoPWwuYXR0cnM7cmV0dXJuIGwuWD1oLng9cixsLlk9aC55PWksbC5XPWgud2lkdGg9bixsLkg9aC5oZWlnaHQ9YSxoLnI9cyxoLnBhdGg9byxsLnR5cGU9XCJyZWN0XCIsbH0sdC5fZW5naW5lLmVsbGlwc2U9ZnVuY3Rpb24odCxlLHIsaSxuKXt2YXIgYT10LnBhdGgoKSxzPWEuYXR0cnM7cmV0dXJuIGEuWD1lLWksYS5ZPXItbixhLlc9MippLGEuSD0yKm4sYS50eXBlPVwiZWxsaXBzZVwiLFQoYSx7Y3g6ZSxjeTpyLHJ4Omkscnk6bn0pLGF9LHQuX2VuZ2luZS5jaXJjbGU9ZnVuY3Rpb24odCxlLHIsaSl7dmFyIG49dC5wYXRoKCksYT1uLmF0dHJzO3JldHVybiBuLlg9ZS1pLG4uWT1yLWksbi5XPW4uSD0yKmksbi50eXBlPVwiY2lyY2xlXCIsVChuLHtjeDplLGN5OnIscjppfSksbn0sdC5fZW5naW5lLmltYWdlPWZ1bmN0aW9uKGUscixpLG4sYSxzKXt2YXIgbz10Ll9yZWN0UGF0aChpLG4sYSxzKSxsPWUucGF0aChvKS5hdHRyKHtzdHJva2U6XCJub25lXCJ9KSx1PWwuYXR0cnMsYz1sLm5vZGUsZj1jLmdldEVsZW1lbnRzQnlUYWdOYW1lKGgpWzBdO3JldHVybiB1LnNyYz1yLGwuWD11Lng9aSxsLlk9dS55PW4sbC5XPXUud2lkdGg9YSxsLkg9dS5oZWlnaHQ9cyx1LnBhdGg9byxsLnR5cGU9XCJpbWFnZVwiLGYucGFyZW50Tm9kZT09YyYmYy5yZW1vdmVDaGlsZChmKSxmLnJvdGF0ZT0hMCxmLnNyYz1yLGYudHlwZT1cInRpbGVcIixsLl8uZmlsbHBvcz1baSxuXSxsLl8uZmlsbHNpemU9W2Esc10sYy5hcHBlbmRDaGlsZChmKSxDKGwsMSwxLDAsMCwwKSxsfSx0Ll9lbmdpbmUudGV4dD1mdW5jdGlvbihlLGksbixzKXt2YXIgbz1NKFwic2hhcGVcIiksbD1NKFwicGF0aFwiKSxoPU0oXCJ0ZXh0cGF0aFwiKTtpPWl8fDAsbj1ufHwwLHM9c3x8XCJcIixsLnY9dC5mb3JtYXQoXCJtezB9LHsxfWx7Mn0sezF9XCIsYShpKmIpLGEobipiKSxhKGkqYikrMSksbC50ZXh0cGF0aG9rPSEwLGguc3RyaW5nPXIocyksaC5vbj0hMCxvLnN0eWxlLmNzc1RleHQ9bSxvLmNvb3Jkc2l6ZT1iK3ArYixvLmNvb3Jkb3JpZ2luPVwiMCAwXCI7dmFyIHU9bmV3IEUobyxlKSxjPXtmaWxsOlwiIzAwMFwiLHN0cm9rZTpcIm5vbmVcIixmb250OnQuX2F2YWlsYWJsZUF0dHJzLmZvbnQsdGV4dDpzfTt1LnNoYXBlPW8sdS5wYXRoPWwsdS50ZXh0cGF0aD1oLHUudHlwZT1cInRleHRcIix1LmF0dHJzLnRleHQ9cihzKSx1LmF0dHJzLng9aSx1LmF0dHJzLnk9bix1LmF0dHJzLnc9MSx1LmF0dHJzLmg9MSxUKHUsYyksby5hcHBlbmRDaGlsZChoKSxvLmFwcGVuZENoaWxkKGwpLGUuY2FudmFzLmFwcGVuZENoaWxkKG8pO3ZhciBmPU0oXCJza2V3XCIpO3JldHVybiBmLm9uPSEwLG8uYXBwZW5kQ2hpbGQoZiksdS5za2V3PWYsdS50cmFuc2Zvcm0oZCksdX0sdC5fZW5naW5lLnNldFNpemU9ZnVuY3Rpb24oZSxyKXt2YXIgaT10aGlzLmNhbnZhcy5zdHlsZTtyZXR1cm4gdGhpcy53aWR0aD1lLHRoaXMuaGVpZ2h0PXIsZT09K2UmJihlKz1cInB4XCIpLHI9PStyJiYocis9XCJweFwiKSxpLndpZHRoPWUsaS5oZWlnaHQ9cixpLmNsaXA9XCJyZWN0KDAgXCIrZStcIiBcIityK1wiIDApXCIsdGhpcy5fdmlld0JveCYmdC5fZW5naW5lLnNldFZpZXdCb3guYXBwbHkodGhpcyx0aGlzLl92aWV3Qm94KSx0aGlzfSx0Ll9lbmdpbmUuc2V0Vmlld0JveD1mdW5jdGlvbihlLHIsaSxuLGEpe3QuZXZlKFwicmFwaGFlbC5zZXRWaWV3Qm94XCIsdGhpcyx0aGlzLl92aWV3Qm94LFtlLHIsaSxuLGFdKTt2YXIgcz10aGlzLmdldFNpemUoKSxvPXMud2lkdGgsbD1zLmhlaWdodCxoLHU7cmV0dXJuIGEmJihoPWwvbix1PW8vaSxvPmkqaCYmKGUtPShvLWkqaCkvMi9oKSxsPm4qdSYmKHItPShsLW4qdSkvMi91KSksdGhpcy5fdmlld0JveD1bZSxyLGksbiwhIWFdLHRoaXMuX3ZpZXdCb3hTaGlmdD17ZHg6LWUsZHk6LXIsc2NhbGU6c30sdGhpcy5mb3JFYWNoKGZ1bmN0aW9uKHQpe3QudHJhbnNmb3JtKFwiLi4uXCIpfSksdGhpc307dmFyIE07dC5fZW5naW5lLmluaXRXaW49ZnVuY3Rpb24odCl7dmFyIGU9dC5kb2N1bWVudDtlLnN0eWxlU2hlZXRzLmxlbmd0aDwzMT9lLmNyZWF0ZVN0eWxlU2hlZXQoKS5hZGRSdWxlKFwiLnJ2bWxcIixcImJlaGF2aW9yOnVybCgjZGVmYXVsdCNWTUwpXCIpOmUuc3R5bGVTaGVldHNbMF0uYWRkUnVsZShcIi5ydm1sXCIsXCJiZWhhdmlvcjp1cmwoI2RlZmF1bHQjVk1MKVwiKTt0cnl7IWUubmFtZXNwYWNlcy5ydm1sJiZlLm5hbWVzcGFjZXMuYWRkKFwicnZtbFwiLFwidXJuOnNjaGVtYXMtbWljcm9zb2Z0LWNvbTp2bWxcIiksTT1mdW5jdGlvbih0KXtyZXR1cm4gZS5jcmVhdGVFbGVtZW50KFwiPHJ2bWw6XCIrdCsnIGNsYXNzPVwicnZtbFwiPicpfX1jYXRjaChyKXtNPWZ1bmN0aW9uKHQpe3JldHVybiBlLmNyZWF0ZUVsZW1lbnQoXCI8XCIrdCsnIHhtbG5zPVwidXJuOnNjaGVtYXMtbWljcm9zb2Z0LmNvbTp2bWxcIiBjbGFzcz1cInJ2bWxcIj4nKX19fSx0Ll9lbmdpbmUuaW5pdFdpbih0Ll9nLndpbiksdC5fZW5naW5lLmNyZWF0ZT1mdW5jdGlvbigpe3ZhciBlPXQuX2dldENvbnRhaW5lci5hcHBseSgwLGFyZ3VtZW50cykscj1lLmNvbnRhaW5lcixpPWUuaGVpZ2h0LG4sYT1lLndpZHRoLHM9ZS54LG89ZS55O2lmKCFyKXRocm93IG5ldyBFcnJvcihcIlZNTCBjb250YWluZXIgbm90IGZvdW5kLlwiKTt2YXIgbD1uZXcgdC5fUGFwZXIsaD1sLmNhbnZhcz10Ll9nLmRvYy5jcmVhdGVFbGVtZW50KFwiZGl2XCIpLHU9aC5zdHlsZTtyZXR1cm4gcz1zfHwwLG89b3x8MCxhPWF8fDUxMixpPWl8fDM0MixsLndpZHRoPWEsbC5oZWlnaHQ9aSxhPT0rYSYmKGErPVwicHhcIiksaT09K2kmJihpKz1cInB4XCIpLGwuY29vcmRzaXplPTFlMypiK3ArMWUzKmIsbC5jb29yZG9yaWdpbj1cIjAgMFwiLGwuc3Bhbj10Ll9nLmRvYy5jcmVhdGVFbGVtZW50KFwic3BhblwiKSxsLnNwYW4uc3R5bGUuY3NzVGV4dD1cInBvc2l0aW9uOmFic29sdXRlO2xlZnQ6LTk5OTllbTt0b3A6LTk5OTllbTtwYWRkaW5nOjA7bWFyZ2luOjA7bGluZS1oZWlnaHQ6MTtcIixoLmFwcGVuZENoaWxkKGwuc3BhbiksdS5jc3NUZXh0PXQuZm9ybWF0KFwidG9wOjA7bGVmdDowO3dpZHRoOnswfTtoZWlnaHQ6ezF9O2Rpc3BsYXk6aW5saW5lLWJsb2NrO3Bvc2l0aW9uOnJlbGF0aXZlO2NsaXA6cmVjdCgwIHswfSB7MX0gMCk7b3ZlcmZsb3c6aGlkZGVuXCIsYSxpKSwxPT1yPyh0Ll9nLmRvYy5ib2R5LmFwcGVuZENoaWxkKGgpLHUubGVmdD1zK1wicHhcIix1LnRvcD1vK1wicHhcIix1LnBvc2l0aW9uPVwiYWJzb2x1dGVcIik6ci5maXJzdENoaWxkP3IuaW5zZXJ0QmVmb3JlKGgsci5maXJzdENoaWxkKTpyLmFwcGVuZENoaWxkKGgpLGwucmVuZGVyZml4PWZ1bmN0aW9uKCl7fSxsfSx0LnByb3RvdHlwZS5jbGVhcj1mdW5jdGlvbigpe3QuZXZlKFwicmFwaGFlbC5jbGVhclwiLHRoaXMpLHRoaXMuY2FudmFzLmlubmVySFRNTD1kLHRoaXMuc3Bhbj10Ll9nLmRvYy5jcmVhdGVFbGVtZW50KFwic3BhblwiKSx0aGlzLnNwYW4uc3R5bGUuY3NzVGV4dD1cInBvc2l0aW9uOmFic29sdXRlO2xlZnQ6LTk5OTllbTt0b3A6LTk5OTllbTtwYWRkaW5nOjA7bWFyZ2luOjA7bGluZS1oZWlnaHQ6MTtkaXNwbGF5OmlubGluZTtcIix0aGlzLmNhbnZhcy5hcHBlbmRDaGlsZCh0aGlzLnNwYW4pLHRoaXMuYm90dG9tPXRoaXMudG9wPW51bGx9LHQucHJvdG90eXBlLnJlbW92ZT1mdW5jdGlvbigpe3QuZXZlKFwicmFwaGFlbC5yZW1vdmVcIix0aGlzKSx0aGlzLmNhbnZhcy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuY2FudmFzKTtmb3IodmFyIGUgaW4gdGhpcyl0aGlzW2VdPVwiZnVuY3Rpb25cIj09dHlwZW9mIHRoaXNbZV0/dC5fcmVtb3ZlZEZhY3RvcnkoZSk6bnVsbDtyZXR1cm4hMH07dmFyIEw9dC5zdDtmb3IodmFyIHogaW4gTilOW2VdKHopJiYhTFtlXSh6KSYmKExbel09ZnVuY3Rpb24odCl7cmV0dXJuIGZ1bmN0aW9uKCl7dmFyIGU9YXJndW1lbnRzO3JldHVybiB0aGlzLmZvckVhY2goZnVuY3Rpb24ocil7clt0XS5hcHBseShyLGUpfSl9fSh6KSl9fS5hcHBseShlLGkpLCEodm9pZCAwIT09biYmKHQuZXhwb3J0cz1uKSl9XSl9KTsiLCJ2YXIgamF6emljb24gPSByZXF1aXJlKCdqYXp6aWNvbicpO1xuXG5cbihmdW5jdGlvbigpe1xuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgZnVuY3Rpb24oKXtcbiAgICB2YXIgaWNvbnMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcudXNlci1pY29uJyk7XG4gICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChpY29ucywgZnVuY3Rpb24oZWwsIGkpe1xuICAgICAgdmFyIG51bSA9IHBhcnNlSW50KCBlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtaWNvbicpLCAxMCk7XG4gICAgICB2YXIgaWNvbiA9IGphenppY29uKDQ4LCBudW0pO1xuICAgICAgZWwuYXBwZW5kQ2hpbGQoaWNvbik7XG4gICAgfSk7XG4gIH0pOyBcbn0pKCk7XG4iXX0=
