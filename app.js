const express = require("express");
const app = express();

const helmet = require("helmet");
const bodyParser = require("body-parser");

const MongoClient = require("mongodb").MongoClient;

const crypto = require("crypto");

// Nodemailer
const nodemailer = require("nodemailer");
const { SMTP } = require("./config.json");

//Error vars
let phoneError = false;
let emailError = false;
let retCode = 0;

// Const variables
const port = 3000;
const urlEncoded = bodyParser.urlencoded({ extended: true });

const { MONGO_URL } = require("./config.json");
const client = new MongoClient(MONGO_URL, { useUnifiedTopology: true });
let collection = "";
client.connect((error) => {
  if (error) {
    return console.error(error);
  }
  collection = client.db("usersdb").collection("usersdb");
});

// Regexp

const phoneRegExp = /^\+?(\d{1,3})?[- .]?\(?(?:\d{2,3})\)?[- .]?\d\d\d[- .]?\d\d\d\d$/;
const emailRegExp = /^[A-Z0-9._%+-]+@[A-Z0-9-]+.+.[A-Z]{2,4}$/i;

// Configs
app.use(express.static(__dirname + "/public"));
app.use(helmet());
app.use(urlEncoded);
app.set("view engine", "pug");

// Routes

app.get("/", async (request, response) => {
  response.render("index", { phoneError, emailError });
});

app.get("/repair", async (request, response) => {
    response.render("repairPhone");
  });

app.get("/events", async (request, response) => {
  if (retCode == 1) {
    response.render("events/success", {
      message: "Добавление элементов выполнено успешно",
    });
  } else if (retCode == 2) {
    response.render("events/success", {
      message: "Сообщение с номером отправлено успешно",
    });
  }

  if (retCode == -1) {
    response.render("events/danger", {
      message: "Данные котрые вы пытаетесь добавить уже существуют",
    });
  } else if (retCode == -2) {
    response.render("events/danger", {
      message: "Номер соответсвующий введенному Email не найден.",
    });
  }
  retCode = 0;
});



app.post("/repair", async (request, response) => {
  const hash = crypto.createHash("sha256");
  const email = hash.update(request.body.email).digest("hex");
  collection.find({ email }).toArray((error, result) => {
    if (error) {
      return console.error(error);
    }

    if (result.length) {
      sendMail(result[0].phone, request.body.email);
      retCode = 2
      response.redirect('/events');
    }else{
        retCode = -2
        response.redirect('/events');
    }
  });
});

app.post("/", async (request, response) => {
  if (!phoneRegExp.test(request.body.phone)) {
    phoneError = true;
    response.redirect("/");
    return;
  }

  if (!emailRegExp.test(request.body.email)) {
    emailError = true;
    response.redirect("/");
    return;
  }

  const hash = crypto.createHash("sha256");

  const phone = request.body.phone;
  const email = hash.update(request.body.email).digest("hex");

  collection.find({ email }).toArray((error, result) => {
    if (error) {
      return console.error(error);
    }
    if (result.length) {
      retCode = -1;
      response.redirect("/events");
      return;
    } else {
      collection.insertOne({ phone, email }, (error, result) => {
        if (error) {
          response.sendStatus(400);
          return console.error(error);
        }
        retCode = 1;
        response.redirect("/events");
        phoneError = emailError = false;
      });
    }
  });
});

async function sendMail(email, phone) {
  console.log(email, phone);

  let testEmailAccount = await nodemailer.createTestAccount();

  const transporter = nodemailer.createTransport({
    host: SMTP.HOST, // Здесь должен быть адресс вашего SMTP сервера
    port: SMTP.PORT, // Порт на котором запущен SMTP сервер
    secure: false,
    auth: {
      user: SMTP.LOGIN,
      pass: SMTP.PASSOWRD,
    },
  });

  await transporter.sendMail({
    from: "Ваш Email",
    to: email,
    subject: "Письмо с сайта",
    text:
      "Это письмо было отправлено автоматически, пожалуйста не отвечайте на него.",
    html: `<strong>  Ваш телефон: ${phone} </strong>`,
  });
}

app.listen(port, () => {
  console.log( `Listening on : http://localhost:${port}` );
});
