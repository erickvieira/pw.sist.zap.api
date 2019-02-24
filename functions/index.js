const functions = require('firebase-functions')
const firebase = require('firebase')
const express = require("express")
const bodyParser = require("body-parser")

const comunicateBy = 'application/json'

const app = express()
const firebaseConfig = require('./api/firebase-config.json')
firebase.initializeApp(firebaseConfig)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({
  extended: true
}))

const fireAuth = firebase.auth()
const fireDB = firebase.database()

app.get('/status', (_, res) => {
  res.type(comunicateBy).send({
    message: 'server online',
    status: 200,
  })
})

app.post('/login', (req, res) => {
  const user = {
    ...req.body
  }
  fireAuth.signInWithEmailAndPassword(
    user.email, 
    user.password
  ).then(authData => {
    const authToken = authData.user.refreshToken
    fireDB.ref(`/users`).orderByChild('id').equalTo(
      authData.user.uid
    ).once('value', (snapshot) => {
      const userColl = snapshot.val()
      if (userColl) {
        const userIndex = Object.keys(userColl)[0]
        let userData = userColl[userIndex]
        if (userData.active) {
          userData = {
            ...userData,
            token: authToken
          }
          fireDB.ref(`/users/${userIndex}`).set(
            userData
          ).then(() => {
            res.type(comunicateBy).send({
              data: userData,
              status: 200,
              message: 'successful login'
            })
          })
        } else {
          res.type(comunicateBy).send({
            status: 403,
            message: 'forbiden: user is not active',
            code: 12,
          })
        }
      } else {
        res.type(comunicateBy).send({
          message: 'user not found on database',
          code: 11,
          status: 404,
        })
      }
    })
  }).catch(error => {
    res.type(comunicateBy).send(error)
    console.error('ERROR: ' + error)
  })
})

app.post('/all_users/', (req, res) => {
  const userToken = `${req.body.token}`

  if (!userToken) {
    res.type(comunicateBy).send({
      status: 403,
      code: 21,
      message: 'no authentication was provided'
    })
    return
  }

  fireDB.ref(`/users`).orderByChild('token').equalTo(
    userToken
  ).on('value', (snapshot) => {
    const userColl = snapshot.val()

    if (userColl == null || Object.keys(userColl).length <= 0) {
      res.type(comunicateBy).send({
        status: 403,
        code: 23,
        message: 'user has no enougth permissions'
      })
      return
    }

    fireDB.ref(`/users`).orderByChild('car').once('value', (snapshot) => {
      const usrColl = snapshot.val()
      const usrCollKeys = Object.keys(usrColl)
      const allDrivers = []
      const allPassengers = []

      if (usrCollKeys && usrCollKeys.length > 0) {
        usrCollKeys.forEach(dk => {
          let usr = usrColl[dk]
          if (usr.token) usr.token = undefined
          if (usr.car) {
            allDrivers.push(usr)
          } else allPassengers.push(usr)
        })
        res.type(comunicateBy).send({
          status: 200,
          data: {
            drivers: allDrivers,
            passengers: allPassengers,
          },
          message: 'all drivers and passengers listed'
        })
      } else {
        res.type(comunicateBy).send({
          status: 404,
          code: 22,
          message: 'no drivers and passengers are found'
        })
      }
    })
  })
})

app.post('/prices', (req, res) => {
  let userToken = `${req.body.token}`

  if (!userToken) {
    res.type(comunicateBy).send({
      status: 403,
      code: 21,
      message: 'no authentication was provided'
    })
    return
  }

  fireDB.ref(`/users`).orderByChild('token').equalTo(
    userToken
  ).on('value', (snapshot) => {
    const userColl = snapshot.val()

    if (userColl == null || Object.keys(userColl).length <= 0) {
      res.type(comunicateBy).send({
        status: 403,
        code: 23,
        message: 'user has no enougth permissions'
      })
      return
    }

    fireDB.ref(
      `/config/prices`
    ).orderByValue().once('value', (snapshot) => {
      const pricesColl = snapshot.val()

      if (pricesColl && Object.keys(pricesColl).length > 0) {
        res.type(comunicateBy).send({
          status: 200,
          data: pricesColl,
          message: 'all prices listed'
        })
      } else {
        res.type(comunicateBy).send({
          status: 404,
          code: 22,
          message: 'no prices are found'
        })
      }
    })
  })
})

exports.zapApi = functions.https.onRequest(app)
