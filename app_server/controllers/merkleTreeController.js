var crypto = require('crypto')

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest()
}

var data = [
  'cafebeef',
  'ffffffff',
  'aaaaaaaa',
  'bbbbbbbb',
  'cccccccc'
].map(x => new Buffer(x, 'hex'))

var merkle = require('../controllers/merkletree')
var tree = merkle(data, sha256)

// console.log("Printing Hashes:\n")
// console.log(sha256(data[0] || data[1]).toString('hex'))

console.log("Printing Tree in Hex:\n")
console.log(tree.map(x => x.toString('hex')))

var fastRoot = require('../controllers/fastRoot')
var root = fastRoot(data, sha256)

var merkleProof = require('../controllers/proof')
var proof = merkleProof(tree, data[0])

if (proof === null) {
  console.error('No proof exists!')
}

console.log("\nProof\n")
console.log(proof.map(x => x && x.toString('hex')))

var d = new Buffer('cafebeef', 'hex')
console.log(d)

console.log(merkleProof.verify(proof, d, root, sha256))