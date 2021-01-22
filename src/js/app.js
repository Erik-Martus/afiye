import '../scss/styles.scss';
// const $ = require('jquery');
import $ from 'jquery';
import { customAlphabet } from 'nanoid';

console.log('From app.js');

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 64);


const api = require('./neo4j.js');

$(function () {
  const initDB = $('#init-DB');
  initDB.on('click', () => {
    console.log('Initializing Database');

    let familyID = nanoid();
    api.initDB(familyID);
  });
});