const path = require('path');
const express = require('express');
const router = express.Router();
const User = require('../models/user.js');
const bcrypt = require('bcrypt');
const { render } = require('sass');
const passport = require('passport');
const {ensureAuthenticated} = require('../server/config/auth.js');

// login handle
router.get('/login', (req, res) => {
  let locals = {
    title: 'Afiye - Account Login'
  };

  res.render(path.resolve(__dirname, '../views/login'), locals);
});
router.get('/register', (req, res) => {
  let locals = {
    title: 'Afiye - Register Account'
  };

  res.render(path.resolve(__dirname, '../views/register'), locals);
});

// register handle
router.post('/register', (req, res) => {
  const {name, email, password, password2} = req.body;
  let errors = [];

  console.log(`Name: ${name} email: ${email} pass: ${password}`);

  if (!name || !email || !password || !password2) {
    errors.push({msg: 'Please fill in all fields'});
  }

  // check if passwords match
  if (password !== password2) {
    errors.push({msg: 'Passwords don\'t match'});
  }

  // check if password is more than 6 characters
  if (password.length < 6) {
    errors.push({msg: 'Password must be at least 6 characters'});
  }

  if (errors.length > 0) {
    res.render(path.resolve(__dirname, '../views/register'), {
      errors: errors,
      name: name,
      email: email,
      password: password,
      password2: password2,
      title: 'Afiye - Register Account',
    });
  } else {
    // validation passed
    User.findOne({email: email}).exec((err, user) => {
      console.log(user);
      if (user) {
        errors.push({msg: 'Email is already registered'});
        render(res, errors, name, email, password, password2);
      } else {
        const newUser = new User({
          name: name,
          email: email,
          password: password
        });
        bcrypt.genSalt(10,(err,salt)=>
            bcrypt.hash(newUser.password,salt,
                (err,hash)=> {
                    if(err) {
                      throw err;
                    } else {
                      //save pass to hash
                      newUser.password = hash;
                    }

                    //save user
                    newUser.save()
                    .then((value)=>{
                      console.log(value);
                      req.flash('success_msg', 'You have now registered!');
                      res.redirect('/account/login');
                    })
                    .catch(value=> console.log(value));
                }));
      }
    });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/account/feed',
    failureRedirect: '/account/login',
    failureFlash: true,
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success_msg', 'You\'ve successfully logged out');
  res.redirect('/account/login');
});

// user feed
router.get('/feed', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Memory Feed',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/feed'), locals);
});

// user tree
router.get('/tree', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Family Tree',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/tree'), locals);
});

// user profile
router.get('/profile', ensureAuthenticated, (req, res) => {
  let locals = {
    title: `Afiye - ${req.user}'s Profile`,
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/profile'), locals);
});

// user settings
router.get('/settings', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Account Settings',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/settings'), locals);
});

module.exports = router;