const express    = require('express');
const controller = require('./controllers/usuarios_controllers');
const morgan     = require('morgan');
const cors       = require('cors');

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());
app.use(controller);

app.listen(3000, async () => {
    console.log('MS1-Usuarios ejecutándose en el puerto 3000');
});