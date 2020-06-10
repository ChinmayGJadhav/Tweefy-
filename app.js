const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash')
const markedown = require('marked')
const csrf = require('csurf')
const sanitizeHTML = require('sanitize-html')

let sessionOptions = session({
  secret: 'JS is Awesome',
  store:new MongoStore( {client: require('./db') } ),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000*60*60*24, httpOnly: true}
})

const app= express()

//passing data
app.use(express.urlencoded({extended:false}))
app.use(express.json())

//api
app.use('/api',require('./router-api'))

app.use(sessionOptions)
app.use(flash())
//Configuring views
app.set('views','views')
app.set('view engine','ejs')


app.use(function(req,res,next){
  //make markedown available from ejs
  res.locals.filterUserHtml= function (content) {
    return markedown(content)
  }
  //make all error and success flasg msgs
  res.locals.errors=req.flash('errors')
  res.locals.success=req.flash('success')

  //make current userid available on req object
  if (req.session.user) {
    req.visitorId = req.session.user._id
  }
  else {
    req.visitorId= 0
  }

  //make user session data available from within view templates
  res.locals.user=req.session.user
  next()
})



//Configuring router
const router = require('./router');

//Configuring static files
app.use(express.static('public'))



//csrf
app.use(csrf())
app.use(function (req,res,next) {
  res.cookie('XSRF-TOKEN',req.csrfToken())
  res.locals.csrfToken = req.csrfToken()
  next()
})

//router files
app.use('/',router)

const server = require('http').createServer(app)
const io = require('socket.io')(server)

//req session data from socket
io.use(function (socket,next) {
  sessionOptions(socket.request,socket.request.res,next)
})

io.on('connection',function (socket) {
  if (socket.request.session.user) {
    let user = socket.request.session.user

    socket.emit('welcome',{username:user.username,avatar:user.avatar})

    socket.on('chatMsgFromBrowser',(data) => {
      socket.broadcast.emit('chatMsgFromServer',{message: sanitizeHTML(data.message,{ allowedTags:[],allowedAttributes:[] } ),username:user.username,avatar:user.avatar})
    })
  }

})
module.exports=server
