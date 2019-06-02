var mongoose = require('mongoose');


var DegreeSchema= new mongoose.Schema({
    degree:[JSON] 
});

module.exports = mongoose.model('Degree',DegreeSchema);
