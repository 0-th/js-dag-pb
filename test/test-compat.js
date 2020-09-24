/* eslint-env mocha */

// tests mirrored in go-merkledag/pb/forms_test.go

import chai from 'chai'
import dagPB from '@ipld/dag-pb'
import multiformats from 'multiformats/basics'
import encodeNode from '../pb-encode.js'
import decodeNode from '../pb-decode.js'

const { assert } = chai

const { multicodec, CID, bytes } = multiformats
multicodec.add(dagPB)

// Hash is raw+identity 0x0001020304 CID(bafkqabiaaebagba)
const acid = new CID(Uint8Array.from([1, 85, 0, 5, 0, 1, 2, 3, 4]))

const encode = (v) => multicodec.encode(v, 'dag-pb')
const decode = (v) => multicodec.decode(v, 'dag-pb')

function verifyRoundTrip (testCase, bypass) {
  const actualBytes = (bypass ? encodeNode : encode)(testCase.node)
  assert.strictEqual(bytes.toHex(actualBytes), testCase.expectedBytes)
  const roundTripNode = (bypass ? decodeNode : decode)(actualBytes)
  if (roundTripNode.Data) {
    roundTripNode.Data = bytes.toHex(roundTripNode.Data)
  }
  if (roundTripNode.Links) {
    for (const link of roundTripNode.Links) {
      if (link.Hash) {
        // they're CIDs which don't stringify well
        // or consistent with our fixtures
        link.Hash = bytes.toHex(bypass ? link.Hash : link.Hash.bytes)
      }
    }
  }
  const actualForm = JSON.stringify(roundTripNode, null, 2)
  assert.strictEqual(actualForm, testCase.expectedForm)
}

describe('Compatibility', () => {
  it('empty', () => {
    verifyRoundTrip({
      node: {},
      expectedBytes: '',
      expectedForm: '{}'
    })
  })

  it('Data zero', () => {
    verifyRoundTrip({
      node: { Data: new Uint8Array(0) },
      expectedBytes: '0a00',
      expectedForm: `{
  "Data": ""
}`
    })
  })

  it('Data some', () => {
    verifyRoundTrip({
      node: { Data: Uint8Array.from([0, 1, 2, 3, 4]) },
      expectedBytes: '0a050001020304',
      expectedForm: `{
  "Data": "0001020304"
}`
    })
  })

  // this is excluded from the spec, it must be undefined
  it('Links zero', () => {
    const testCase = {
      node: { Links: [] },
      expectedBytes: '',
      expectedForm: '{}'
    }
    assert.throws(() => verifyRoundTrip(testCase), /Links/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  // this is excluded from the spec, it must be undefined
  it('Data some Links zero', () => {
    const testCase = {
      node: { Data: Uint8Array.from([0, 1, 2, 3, 4]), Links: [] },
      expectedBytes: '0a050001020304',
      expectedForm: `{
  "Data": "0001020304"
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Links/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  it('Links empty', () => {
    const testCase = {
      node: { Links: [{}] },
      expectedBytes: '1200',
      expectedForm: `{
  "Links": [
    {}
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Hash/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  it('Data some Links empty', () => {
    const testCase = {
      node: { Data: Uint8Array.from([0, 1, 2, 3, 4]), Links: [{}] },
      expectedBytes: '12000a050001020304',
      expectedForm: `{
  "Data": "0001020304",
  "Links": [
    {}
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Hash/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  // this is excluded from the spec, it must be a CID bytes
  it('Links Hash zero', () => {
    const testCase = {
      node: { Links: [{ Hash: new Uint8Array(0) }] },
      expectedBytes: '12020a00',
      expectedForm: `{
  "Links": [
    {
      "Hash": ""
    }
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /CID/)
    // bypass straight to encode and decode and it should verify the bytes,
    // the failure is on the way in _and_ out, so we have to bypass encode & decode
    verifyRoundTrip(testCase, true)
    // don't bypass decode and check the bad CID test there
    assert.throws(() => decode(bytes.fromHex(testCase.expectedBytes)), /CID/)
  })

  it('Links Hash some', () => {
    verifyRoundTrip({
      node: { Links: [{ Hash: acid }] },
      expectedBytes: '120b0a09015500050001020304',
      expectedForm: `{
  "Links": [
    {
      "Hash": "015500050001020304"
    }
  ]
}`
    })
  })

  it('Links Name zero', () => {
    const testCase = {
      node: { Links: [{ Name: '' }] },
      expectedBytes: '12021200',
      expectedForm: `{
  "Links": [
    {
      "Name": ""
    }
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Hash/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  // same as above but with a Hash
  it('Links Hash some Name zero', () => {
    verifyRoundTrip({
      node: { Links: [{ Hash: acid, Name: '' }] },
      expectedBytes: '120d0a090155000500010203041200',
      expectedForm: `{
  "Links": [
    {
      "Hash": "015500050001020304",
      "Name": ""
    }
  ]
}`
    })
  })

  it('Links Name some', () => {
    const testCase = {
      node: { Links: [{ Name: 'some name' }] },
      expectedBytes: '120b1209736f6d65206e616d65',
      expectedForm: `{
  "Links": [
    {
      "Name": "some name"
    }
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Hash/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  // same as above but with a Hash
  it('Links Hash some Name some', () => {
    verifyRoundTrip({
      node: { Links: [{ Hash: acid, Name: 'some name' }] },
      expectedBytes: '12160a090155000500010203041209736f6d65206e616d65',
      expectedForm: `{
  "Links": [
    {
      "Hash": "015500050001020304",
      "Name": "some name"
    }
  ]
}`
    })
  })

  it('Links Tsize zero', () => {
    const testCase = {
      node: { Links: [{ Tsize: 0 }] },
      expectedBytes: '12021800',
      expectedForm: `{
  "Links": [
    {
      "Tsize": 0
    }
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Hash/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  // same as above but with a Hash
  it('Links Hash some Tsize zero', () => {
    verifyRoundTrip({
      node: { Links: [{ Hash: acid, Tsize: 0 }] },
      expectedBytes: '120d0a090155000500010203041800',
      expectedForm: `{
  "Links": [
    {
      "Hash": "015500050001020304",
      "Tsize": 0
    }
  ]
}`
    })
  })

  it('Links Name some', () => {
    const testCase = {
      node: { Links: [{ Tsize: 1010 }] },
      expectedBytes: '120318f207',
      expectedForm: `{
  "Links": [
    {
      "Tsize": 1010
    }
  ]
}`
    }
    assert.throws(() => verifyRoundTrip(testCase), /Hash/)
    // bypass straight to encode and it should verify the bytes
    verifyRoundTrip(testCase, true)
  })

  // same as above but with a Hash
  it('Links Hash some Tsize some', () => {
    verifyRoundTrip({
      node: { Links: [{ Hash: acid, Tsize: 1010 }] },
      expectedBytes: '120e0a0901550005000102030418f207',
      expectedForm: `{
  "Links": [
    {
      "Hash": "015500050001020304",
      "Tsize": 1010
    }
  ]
}`
    })
  })
})
