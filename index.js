const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const server = express();
const {assign} = Object;
const {parse} = JSON;
const url = 'mongodb://localhost:27017/local';
let db;

MongoClient.connect(url, function(err, database) {
  assert.equal(null, err);
  console.log("Connected correctly to server");
  db = database;
});

const extractParameters = (names, query) =>
  names.reduce((prev, name) => assign(prev, {[name]: parse(query[name] || 'null')}), {})

const extractProjection = attributeList =>
  Array.isArray(attributeList) ? attributeList.reduce((prev, attribute) => assign(prev, {[attribute]: 1}), {}) : {};

server.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, X-Algolia-API-Key, X-Algolia-Application-Id");
  next();
});

server.get('/algolia/:collection/:id', (req, res, next) => {
  const params = extractParameters(['attributesToRetrieve'], req.query);

  db.collection(req.params.collection)
    .findOne({id: parseInt(req.params.id, 10)}, {fields: extractProjection(params.attributesToRetrieve)})
    .then(hit => res.json(hit), next);
});

server.get('/algolia/:collection', (req, res, next) => {
  const params = extractParameters(['facetFilters', 'numericFilters', 'attributesToRetrieve', 'hitsPerPage', 'tagFilters'], req.query);
  const query = {};
  if (params.tagFilters) {
    query._tags = {$all: params.tagFilters.replace('(', '').replace(')', '').split(',')};
  }

  if (Array.isArray(params.facetFilters)) {
    params.facetFilters
          .map(filter => filter.split(':'))
          .forEach(([name, value]) => query[name] = value);
  }

  if (Array.isArray(params.numericFilters)) {
    params.numericFilters
          .map(filter => filter.split('='))
          .forEach(([name, value]) => query[name] = {$in: [parseInt(value, 10) > 0, parseInt(value, 10)]});
  }

  db.collection(req.params.collection)
    .find(query)
    .limit(params.hitsPerPage || 20)
    .project(extractProjection(params.attributesToRetrieve))
    .toArray((err, hits) => err ? next(err) : res.json({hits}));
});

server.get('/:collection', (req, res, next) => {
  const params = extractParameters(['query', 'limit', 'skip', 'project', 'sort'], req.query);
  db.collection(req.params.collection)
    .find(params.query)
    .limit(params.limit || 20)
    .skip(params.skip || 0)
    .sort(params.sort)
    .project(params.project || {})
    .toArray((err, result) => err ? next(err) : res.json(result));
});

server.listen(9000);
