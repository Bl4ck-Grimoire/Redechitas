const express           = require('express');
const morgan            = require('morgan');
const cors              = require('cors');
const gestionController = require('./controllers/gestionController');
const pagosController   = require('./controllers/pagosController');

const app = express();

app.use(morgan('dev'));
app.use(cors());
app.use(express.json());

app.use(gestionController);   // rutas /api/gestiones
app.use(pagosController);     // rutas /api/pagos

app.listen(3002, () => {
    console.log('MS3-GestionPropiedades ejecutándose en el puerto 3002');
});