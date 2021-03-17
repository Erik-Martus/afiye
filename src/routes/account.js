const path = require('path');
const express = require('express');
const router = express.Router();
const {ensureAuthenticated} = require('../server/config/auth.js');
const User = require('../models/user.js');
const Post = require('../models/post.js');
const Album = require('../models/album.js');
const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('1234567890abdefhijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 10);
const api = require('../server/neo4j.js');
const cloudinary = require('../server/config/cloudinary');
const streamifier = require('streamifier');
const multer = require('multer');
const fileUpload = multer();
const _ = require('lodash');

// Upload to Cloudinar
function upload(file, folder) {
  return new Promise((resolve, reject) => {
    let stream = cloudinary.uploader.upload_stream(
      {
        folder: `uploads/${folder}`,
        eager: [
          {quality: '60'}
        ]
      },
      (error, result) => {
        if (result) {
          return resolve(result);
        } else {
          reject(error);
        }
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
}

// Calculate rounded time distance
function timeDiff(start) {
  const sec = 1000,
        min = sec*60,
        hr = min*60,
        day = hr*24,
        mn = day*30,
        yr = day*365;
  let dMillis = Date.now() - start,
      dSec = dMillis/sec,
      dMin = dMillis/min,
      dHr = dMillis/hr,
      dDay = dMillis/day,
      dMn = dMillis/mn,
      dYr = dMillis/yr;
  if (dYr > 1) {
    return Math.floor(dYr) + ' year';
  } else if (dMn > 1) {
    return Math.floor(dMn) + ' month';
  } else if (dDay > 1) {
    return Math.floor(dDay) + ' day';
  } else if (dHr > 1) {
    return Math.floor(dHr) + ' hour';
  } else if (dMin > 1) {
    return Math.floor(dMin) + ' minute';
  } else if (dSec > 1) {
    return Math.floor(dSec) + ' second';
  } else {
    return 'Just Now';
  }
}

// * user onboarding
router.get('/welcome', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Profile Setup',
    user: req.user
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/onboarding'), locals);
});

router.post('/welcome', ensureAuthenticated, (req, res) => {
  const { mode } = req.body;
  if (mode === 'make-a-tree') {
    res.redirect('/account/welcome-make');
  } else {
    res.redirect('/account/welcome-join');
  }
});

// * user onboarding - make a tree
router.get('/welcome-make', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Making a Tree',
    user: req.user
  };

  // res.render(path.resolve(__dirname, '../views/user/onboarding/createprofile'), locals);
  res.render(path.resolve(__dirname, '../views/user/onboarding/onboarding-make'), locals);
});

router.post('/welcome-make', ensureAuthenticated, fileUpload.single('profile'), (req, res) => {
  const { prefName, birthdate, gender, location, profileColor } = req.body;
  const user = req.user;
  const fid = 'f' + nanoid();
  let errors = [];

  User.findOneAndUpdate({uid: user.uid},{fid: fid, node: true},{new: true}).exec((err, user) => {
    if (!user) {
      errors.push({msg: 'We ran into a problem locating your account. Refresh the page or re-register for an account if the problem persists.'});
      res.render(path.resolve(__dirname, '../views/user/onboarding/onboarding-make'), {
        errors: errors,
        title: 'Afiye - Making a Tree',
        user: req.user
      });
    } else {
      let avatarUrl;

    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          {
            folder: `uploads/${req.user.fid}/${req.user.uid}`
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const upload = async (req) => {
      if (!req.file) {
        avatarUrl = 'https://res.cloudinary.com/afiye-io/image/upload/v1614875519/avatars/placeholder_female_akgvlb.png';
      } else {
        let result = await streamUpload(req);
        avatarUrl = result.secure_url;
      }
    };

    upload(req)
      .then(() => {
        const person = {
          uid: user.uid,
          fid: fid,
          firstName: user.firstName,
          prefName: prefName,
          lastName: user.lastName,
          birthdate: birthdate,
          gender: gender,
          location: location,
          profileColor: `#${profileColor}`,
          avatar: avatarUrl,
          claimed: true,
        };

        api.initFamily(person);

        res.redirect('/account/feed');
      });
    }
  });
});

// * user onboarding - join a tree
router.get('/welcome-join', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Joining a Tree',
    user: req.user
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/onboarding-join'), locals);
});

// * user feed
router.get('/feed', ensureAuthenticated, (req, res) => {
  // check if user node has been created
  if (req.user.node === false) {
    res.redirect('/account/welcome');
  } else {
    Post.find({family: req.user.fid}).exec((err, posts) => {
      api.getFamily(req.user)
        .then((result) => {
          let postData = [];
          posts.forEach(post => {
            const ownerData = _.find(result, {'uid': post.owner});
            let timeStamp = timeDiff(post.date);
            postData.push({ownerData, timeStamp, post});
          });
          let locals = {
            title: 'Afiye - Memory Feed',
            user: req.user,
            data: {
              family: result,
              postData
            }
          };
          res.render(path.resolve(__dirname, '../views/user/feed/feed'), locals);
        });
    });
  }
});

// user post
router.get('/post-:family-:pid', ensureAuthenticated, (req, res) => {
  let postFamily = req.params.family,
      postId = req.params.pid;

  console.log('postFamily ', postFamily);
  console.log('post id ', postId);

  Post.findOne({ family: postFamily, pid: postId}).exec((err, post) => {
    if (!post) {
      res.redirect('/account/feed');
    } else {
      api.getNode(post.owner)
        .then((result) => {
          let timeStamp = timeDiff(post.date);
          let locals = {
            title: 'Afiye - Post',
            user: req.user,
            data: {
              postOwner: result,
              timeStamp,
              post
            }
          };
          console.log(locals);
          res.render(path.resolve(__dirname, '../views/user/feed/post'), locals);
        });
    }
  });
});

// create post
router.get('/add-post', ensureAuthenticated, (req, res) => {
  api.getFamily(req.user)
    .then((result) => {
      let familyMembers = _.pull(result, _.find(result, {'uid': req.user.uid}));

      let locals = {
        title: 'Afiye - Create Post',
        user: req.user,
        data: {
          family: familyMembers,
        }
      };

      res.render(path.resolve(__dirname, '../views/user/feed/add-post'), locals);
    });
});

router.post('/add-post', ensureAuthenticated, fileUpload.array('post-media-upload'), async (req, res) => {
  const { title, description, tagged_family} = req.body;
  const pid = 'p' + nanoid();

  const files = req.files;

  try {
    let urls = [];
    let multiple = async (path) => await upload(path, `${req.user.fid}/${pid}`);
    for (const file of files) {
      const newPath = await multiple(file);
      urls.push(newPath.secure_url);
    }
    if (urls) {
      console.log('media:', urls);
      let newPost = new Post({
        owner: req.user.uid,
        family: req.user.fid,
        pid,
        title,
        description,
        media: urls,
        tagged: tagged_family
      });
      await newPost.save()
        .then(() => {
          console.log(newPost);
          return res.redirect('/account/feed');
        }).catch(error => {
          return res.json(error);
        });
    }
  } catch (e) {
    console.log('err :', e);
    return e;
  }
});

router.get('/add-album', ensureAuthenticated, (req, res) => {
  Post.find({family: req.user.fid, owner: req.user.uid}).exec((err, posts) => {
    api.getFamily(req.user)
      .then((result) => {
        let postData = [];
        posts.forEach(post => {
          const ownerData = _.find(result, {'uid': post.owner});
            let timeStamp = timeDiff(post.date);
            postData.push({ownerData, timeStamp, post});
        });

        let familyMembers = _.pull(result, _.find(result, {'uid': req.user.uid}));

        let locals = {
          title: 'Afiye - Create Album',
          user: req.user,
          data: {
            family: familyMembers,
            postData
          }
        };
        res.render(path.resolve(__dirname, '../views/user/feed/add-album'), locals);
      });
  });
});

router.post('/add-album', ensureAuthenticated, (req, res) => {
  console.log(req.body);
  const {title, description, posts, tagged_family} = req.body;
  const alid = 'al' + nanoid();

  Post.findOne({family: req.user.fid, pid: posts[0]}).exec((err, post) => {
    let newAlbum = new Album({
      owner: req.user.uid,
      family: req.user.fid,
      alid,
      title,
      description,
      cover: post.media[0],
      posts,
      tagged: tagged_family,
    });

    console.log(newAlbum);

    newAlbum.save()
      .then(() => {
        console.log(newAlbum);
        return res.redirect('/account/feed');
      }).catch(error => {
        return res.json(error);
      });
  });
});

// modal
// user post
router.get('/modal', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tagged',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/partials/modal'), locals);
});

// welcome
router.get('/welcome', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tagged',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/welcome'), locals);
});

// profile-color
router.get('/pcok', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Profile color',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/pcok'), locals);
});

// joining tree
router.get('/joiningtree', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Join Tree',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/joiningtree'), locals);
});

// input code
router.get('/inputcode', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Join Tree',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/inputcode'), locals);
});

// claim profile
router.get('/claimprofile', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Join Tree',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/claimprofile'), locals);
});

// claim profile 2
router.get('/claimprofile-2', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Join Tree',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/claimprofile-2'), locals);
});

// making a tree
router.get('/makingtree', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tagged',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/makingtree'), locals);
});

// create a profile
router.get('/createprofile', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tagged',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/createprofile'), locals);
});

// create profile-circle
router.get('/pcok-I', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Profile-circle',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/pcok-I'), locals);
});

// join tree done
router.get('/jt-done', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Profile-circle',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/onboarding/jt-done'), locals);
});

// user tree
router.get('/tree', ensureAuthenticated, (req, res) => {
  api.getData(req.user)
    .then((result) => {
      let locals = {
        title: 'Afiye - Family Tree',
        user: req.user,
        data: {
          user: {
            name: req.user.name
          },
          graph: result
        }
      };

      res.render(path.resolve(__dirname, '../views/user/tree/tree'), locals);
    });
});

router.get('/add-member', ensureAuthenticated, (req, res) => {
  api.getFamily(req.user)
    .then((result) => {
      let locals = {
        title: 'Afiye - Add Family Member',
        user: req.user,
        data: {
          family: result,
        }
      };

      res.render(path.resolve(__dirname, '../views/user/add-member'), locals);
    });
});


router.post('/add-member', ensureAuthenticated, fileUpload.single('profile'), (req, res) => {
  const { firstName, prefName, lastName, birthdate, gender, relation, related, location, profileColor } = req.body;
  let errors = [];
  let relReciprocal = (relation === 'child')    ? 'parent'
                    : (relation === 'parent')   ? 'child'
                    : (relation === 'sibling')  ? 'sibling'
                    : (relation === 'spouse')   ? 'spouse'
                    : 'Unknown';

  // check if relationship is valid and has a recipricol path
  if (relReciprocal === 'Unknown') {
    errors.push({msg: 'Please select a relationhip to a current family member'});
  }

  if (errors.length > 0) {
    api.getFamily(req.user)
    .then((result) => {
      let locals = {
        title: 'Afiye - Add Family Member',
        user: req.user,
        data: {
          family: result,
        }
      };

      res.render(path.resolve(__dirname, '../views/user/add-member'), locals);
    });
  } else {
    const uid = 'u' + nanoid(); // db identifier for user
    let avatarUrl;

    let streamUpload = (req) => {
      return new Promise((resolve, reject) => {
        let stream = cloudinary.uploader.upload_stream(
          {
            folder: `uploads/${req.user.fid}/${uid}`,
            eager: [
              {quality: 'auto'}
            ]
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );

        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const upload = async (req) => {
      if (!req.file) {
        avatarUrl = 'https://res.cloudinary.com/afiye-io/image/upload/v1614875519/avatars/placeholder_female_akgvlb.png';
      } else {
        let result = await streamUpload(req);
        avatarUrl = result.secure_url;
      }
    };

    upload(req)
      .then(() => {
        const person = {
          uid: uid,
          fid: req.user.fid,
          firstName: firstName,
          prefName: prefName,
          lastName: lastName,
          birthdate: birthdate,
          gender: gender,
          location: location,
          profileColor: `#${profileColor}`,
          relation: relation,
          relReciprocal: relReciprocal,
          related: related,
          avatar: avatarUrl,
          claimed: false,
        };

        console.log(person);

        api.addMember(person)
          .then(results => {
            if (Object.keys(results[0].directRelation).length >= 1) {
              let match = '';
              let merge = '';

              // Find all members of a family
              results[0].members.forEach(member => {
                const m = member.properties.uid;

                match += `MATCH (${m}:Person {uid: '${m}'}) `;
              });

              results[0].directRelation.forEach(relation => {
                const s = relation.s,
                      r = relation.directPath,
                      t = relation.t;

                merge += `MERGE (${s})-[:RELATED {relation: '${r}'}]->(${t}) `;
              });

              const query = match + merge + 'RETURN *';

              api.submitQuery(query);
              res.redirect('/account/tree');
            } else {
              res.redirect('/account/tree');
            }
          });
      });
  }
});

// * user profile
router.get('/profile', ensureAuthenticated, (req, res) => {
  let locals = {
    title: `Afiye - ${req.user.name}'s Profile`,
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/profile/profile'), locals);
});

// * user settings
router.get('/settings', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Settings',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings'), locals);
});

// user settings
router.get('/settings-account', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Account Settings',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-account'), locals);
});

// user settings
router.get('/settings-account-change-password', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Change Password',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-account-change-password'), locals);
});

// user settings
router.get('/settings-account-leave-tree', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Leave Tree',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-account-leave-tree'), locals);
});

router.get('/settings-account-deactivate', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Deactivate Account',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-account-deactivate'), locals);
});

router.get('/settings-privacy', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Privacy Settings',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-privacy'), locals);
});

router.get('/settings-accessibility', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Accessibility Options',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-accessibility'), locals);
});


router.get('/settings-email', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Email Notifications',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/settings/settings-email'), locals);
});

router.get('/tree-tutorial-1', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tree Tutorial 1',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/tree/tree-tutorial-1'), locals);
});

router.get('/tree-tutorial-2', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tree Tutorial 2',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/tree/tree-tutorial-2'), locals);
});

router.get('/tree-tutorial-3', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tree Tutorial 3',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/tree/tree-tutorial-3'), locals);
});

router.get('/tree-tutorial-4', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tree Tutorial 4',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/tree/tree-tutorial-4'), locals);
});

router.get('/tree-tutorial-5', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tree Tutorial 5',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/tree/tree-tutorial-5'), locals);
});

router.get('/tree-tutorial-6', ensureAuthenticated, (req, res) => {
  let locals = {
    title: 'Afiye - Tree Tutorial 6',
    user: req.user,
  };

  res.render(path.resolve(__dirname, '../views/user/tree/tree-tutorial-6'), locals);
});

module.exports = router;