const bodyparser = require('body-parser');
const express = require('express');

const UserController = require('../controllers/userController');
const SpotifyHelper = require('../helpers/spotifyHelper');

const router = express.Router();
const app = express();

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));

async function validate(userId, accessToken) {
  const user = await SpotifyHelper.getMe(accessToken);
  return user.id === userId;
}

async function isAdmin(userId, refreshToken) {
  if (userId !== '56qvpj5zn6okifdhfoaae6vwc') return false;

  const accessToken = await SpotifyHelper.getNewAccessToken(refreshToken);
  return validate(userId, accessToken);
}

router.get('/', function (req, res) {
  return res.send('You hit playlist gen');
});

router.post('/migration', async function (req, res) {
  const { userId, refreshToken } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const users = await UserController.getAllUsers();

  console.log(`Running ${users.length} migrations`);
  for (let i = 0; i < users.length; i += 1) {
    console.log(`${i + 1}. Running migration for user: ${users[i].userId}`);
    // operation goes here
    await users[i].save();
  }

  return res.send('Migration complete');
});

router.post('/force', async function (req, res) {
  const { userId, refreshToken } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const users = await UserController.getAllUsers();
  SpotifyHelper.updatePlaylists(users);
  return res.send('Playlist Generation has been started');
});

router.post('/forceNoUpdate', async function (req, res) {
  const { userId, refreshToken, count } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const users = await UserController.getAllUsers();

  for (let i = 0; i < count; i += 1) {
    await SpotifyHelper.updatePlaylistsNoUpdate(users);
  }

  return res.send('Playlist Generation has been started');
});

router.post('/forceSingle', async function (req, res) {
  const { userId, refreshToken, target } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const user = await UserController.getUser(target);

  if (!user) {
    return res.status(403).send('User does not exist');
  }

  await SpotifyHelper.updatePlaylist(user, null);

  return res.send(`Playlist updated for user: ${target}`);
});

router.post('/count', async function (req, res) {
  const { userId, refreshToken } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const users = await UserController.getAllUsers();
  return res.send(`Total users: ${users.length}`);
});

router.post('/users', async function (req, res) {
  const { userId, refreshToken } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const users = await UserController.getAllUsers();
  return res.send({ users });
});

router.post('/userIds', async function (req, res) {
  const { userId, refreshToken } = req.body;
  if (!isAdmin(userId, refreshToken)) {
    return res.status(403).send('Invalid credentials');
  }

  const users = await UserController.getAllUsers();

  return res.send(users.map((u) => u.userId));
});

router.get('/getUser/:userId', async function (req, res) {
  const user = await UserController.getUser(req.params.userId);
  if (user && user.userId) {
    return res.status(200).send({
      user: {
        userId: user.userId,
        playlistId: user.playlistId,
        lastUpdated: user.lastUpdated,
        refreshToken: user.refreshToken,
        playlistOptions: user.playlistOptions,
      },
      now: new Date(),
    });
  }
  return res.status(200).send({ success: false });
});

router.get('/now', async function (req, res) {
  return res.status(200).send({ now: new Date() });
});

router.post('/subscribe', async function (req, res) {
  const { userId, refreshToken, options } = req.body;

  console.log(`Subscribing for user: ${userId}`);

  let user = await UserController.getUser(userId);
  if (user) {
    user.refreshToken = refreshToken;
  } else {
    user = await UserController.createUser(userId, refreshToken, options);
  }

  await SpotifyHelper.updatePlaylist(user, null);

  return res.send({ user, now: new Date() });
});

router.post('/unsubscribe', async function (req, res) {
  const { userId, accessToken } = req.body;
  if (!(await validate(userId, accessToken))) {
    return res.send({ success: false });
  }
  console.log(`Unsubscribing user: ${userId}`);

  await UserController.deleteUser(userId);
  return res.send({ success: true });
});

router.post('/restorePlaylistOptions', async function (req, res) {
  const { userId, accessToken } = req.body;
  if (!(await validate(userId, accessToken))) {
    return res.send({ success: false });
  }

  console.log(`Restoring playlist options for user: ${userId}`);

  const user = await UserController.restorePlaylistOptions(userId);

  return res.send({ user });
});

router.post('/updatePlaylistOptions', async function (req, res) {
  const { userId, accessToken, options } = req.body;
  if (!(await validate(userId, accessToken))) {
    return res.send({ success: false });
  }

  console.log(`Updating playlist options for user: ${userId}`);

  const user = await UserController.updatePlaylistOptions(userId, options);
  return res.send({ user });
});

router.post('/refreshToken', async function (req, res) {
  const { code, redirectUri } = req.body;
  // eslint-disable-next-line camelcase
  const { access_token, refresh_token } = await SpotifyHelper.getRefreshToken(
    code,
    redirectUri
  );
  return res.status(200).send({ access_token, refresh_token });
});

router.post('/accessToken', async function (req, res) {
  const { refreshToken } = req.body;
  const accessToken = await SpotifyHelper.getNewAccessToken(refreshToken);
  return res.status(200).send({ accessToken });
});

module.exports = router;
