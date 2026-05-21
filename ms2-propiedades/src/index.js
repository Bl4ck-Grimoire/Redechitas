const express = require('express'); 
const conjuntoController = require('./controllers/conjunto_controllers'); 
const torresController = require('./controllers/torre_controllers'); 
const apartamentoController = require('./controllers/apartamento_controllers'); 
const parqueaderoController = require('./controllers/parqueadero_controllers'); 
const morgan = require('morgan'); 
const cors = require('cors'); 
const app = express(); 

app.use(morgan('dev')); 
app.use(cors());
app.use(express.json()); 

app.use(conjuntoController); 
app.use(torresController); 
app.use(apartamentoController); 
app.use(parqueaderoController);
 
app.listen(3001, () => { 
  console.log('capasBack ejecutandose en el puerto 3001'); 
}); 