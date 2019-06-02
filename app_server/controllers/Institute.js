var mongoose = require('mongoose');
var express = require('express');
var User = require('../models/entity');
var certificate = require('../models/certificate');
var degree = require('../models/degree');
const bcrypt = require('bcryptjs');
var XLSX = require('xlsx')
var recepient = require('../models/recepient');
var student = require('../models/student_info');
var nodemailer = require('nodemailer');
var crypto = require('crypto')
var blockchain = require('../controllers/BlockChain')
var merkle = require('../controllers/merkletree')
var fastRoot = require('../controllers/fastRoot')
var merkleProof = require('../controllers/proof')


module.exports.UpdatePublicKey=function(req,res)
{
    const id = req.params.id;
    const pkey=req.params.pkey;

    console.log("id",id);
    console.log("pkey",pkey);
    
    // Assuming Public Key is now updated
    var institutePubKey = "0x6e6f07247161e22e1a259196f483ccec21dfbff9"
    console.log("Publishing transaction on Blockchain from Central Authority to Institute")
    fromPubKey = process.env.WALLET_ADDRESS
    fromPvtKey = process.env.WALLET_PRIVATE_KEY
    toPubKey = institutePubKey
    data = ""
    const txid = blockchain.publishOnBlockchain(data, fromPvtKey, fromPubKey, toPubKey, 5)
    console.log(txid)

    res.send(200)
}


module.exports.GetDegrees = function(req,res)
{
    const pkey=req.params.pkey;
    console.log("get certificate called");   
    console.log("pubkey",pkey);
    degree.find({'degree.Public Key': pkey}, function(err, res2){
        if (err){
            console.log(err)
        } else{
            console.log(res2)
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(res2));
        }
    })
}


module.exports.ViewDegree = function(req, res){
    const degreeid = req.params.degreeid
    console.log("View Degree called!")
    console.log("Degree ID", degreeid)
    degree.findById(degreeid, function(err, res2){
        if (err){
            console.log(err)
        } else{
            console.log(res2)
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(res2));
        }
    })
}


module.exports.CreateDegree = function (req, res) {
    const title = req.body.title;
    var newcertificate = new certificate({
        Title: title,
        Fields: req.body.feature
    });

    newcertificate["DateofCreation"] = Date.now();
    console.log(newcertificate);
    newcertificate.save();
    res.redirect('/Institute/Certificate/Draft');
}
module.exports.DraftCertificate = function (req, res) {
    certificate.find({}, function (err, degree) {
        var InstituteName = req.session.name;
        res.render('Institute/CertificateDraft', {
            degree,
            InstituteName
        })
    })
}
module.exports.loadCertificate = function (req, res) {
    certificate.findById(req.params.id, function (err, degree) {
        recepient.find({
            InstituteID: req.session.uid
        }, (err, recep) => {

            var InstituteName = req.session.name;

            res.render('Institute/Certificate', {
                degree,
                recep,
                InstituteName
            });
        })
    });


}

module.exports.setPassword = function (req, res) {

    bcrypt.hash(req.body.password2, 10, function (err, hash) {
        if (err) {
            console.log(err);
            throw err;
        }
        User.findOneAndUpdate({
            _id: req.session.uid
        }, {
            $set: {
                Password: hash
            }
        }, (error, result) => {
            if (error)
                console.log(error);

        });

        res.redirect('/Institute/landing2');
    });

}

module.exports.uploadRecepient = function (req, res) {

    console.log("in server side of upload ercep");

    var workbook = XLSX.readFile('./public/Uploads/' + req.file.filename);
    var sheet_name_list = workbook.SheetNames;
    var xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
    console.log(xlData);


    let studentInfo = new student({
        data: xlData,
        InstituteID: req.session.uid,
        Name: req.file.filename.slice(0, -5)
    });

    studentInfo.save(function (err, result) {
        if (err) {
            console.log(err);
            throw err;
        } else {
            console.log(result);

        }
    });

    console.log(xlData.length)
    /*
    var wb = XLSX.readFile("./public/Uploads/"+req.file.filename);
    console.log(wb);*/

    let newRecepient = new recepient({
        Status: "Pending",
        Records: xlData.length,
        FilePath: req.file.filename,
        IssueDate: Date.now(),
        InstituteID: req.session.uid,
        Name: req.file.filename.slice(0, -5)

    });

    newRecepient.save(function (err, result) {
        if (err) {
            console.log(err);
            throw err;
        } else {
            console.log(result);

            res.send({
                result
            });
        }
    });

}



module.exports.loadRecepient = function (req, res) {
    recepient.find({
        InstituteID: req.session.uid
    }, (err, recep) => {

        var InstituteName = req.session.name;

        res.render('Institute/Recipients', {
            recep,
            InstituteName
        });
    })


}

function sha256 (data) {
    return crypto.createHash('sha256').update(data).digest()
}

module.exports.IssueCertificates = function (req, res) {
    console.log(req.body.templateid);
    var path = req.body.recepient + ".xlsx";
    console.log(path);

    var workbook = XLSX.readFile('./public/Uploads/' + req.body.recepient + ".xlsx");
    var sheet_name_list = workbook.SheetNames;
    var xlData = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

    certificate.findById({
        _id: req.body.templateid
    }, function (err, result) {
        if (err) {
            console.log(err);
            throw err;
        }

        var JSONDATA = [];
        for (let index = 0; index < xlData.length; index++) {

            var temp = {};
            const element = xlData[index];

            result.Fields.forEach((attribute) => {
                var columnName = attribute;
                temp[columnName] = element[attribute];
            });
            temp['Public Key'] = "0x6e6F07247161E22E1a259196F483cCEC21dfBfF9"
            JSONDATA.push(temp);
        };
        
        console.log(JSONDATA);

        // Computing hashes of JSONDATA to construct merkle tree
        var certHashes = []
        for (let i = 0;i < JSONDATA.length;++i){
            dataHash = sha256(JSON.stringify(JSONDATA[i]))
            certHashes.push(dataHash)
        }

        console.log("\nHashes of Certificates\n")
        console.log(certHashes.map(x => x.toString('hex')))

        var tree = merkle(certHashes, sha256)

        console.log("Printing Tree in Hex:\n")
        console.log(tree.map(x => x.toString('hex')))

        var root = fastRoot(certHashes, sha256)
        console.log("Root:\t" + root.toString('hex'))

        // Computing Proofs for each Certificate
        var proofs = []
        for (let i = 0;i < certHashes.length;++i){
            var proof = merkleProof(tree, certHashes[i])
            console.log("Proof Type:\t")
            console.log(typeof(proof))
            console.log(proof)
            if (proof === null) {
                console.error('No proof exists!')
            }
            proofs.push(proof)
            JSONDATA[i]['Proof'] = proof.map(x => x && x.toString('hex'))
            console.log(JSONDATA[i])
            console.log("Proof for Certificate " + i + "\n")
            console.log(proof.map(x => x && x.toString('hex')))
        }
        
        // Verifying Proof for each Certificate
        for (let i = 0;i < certHashes.length;++i){
            console.log(merkleProof.verify(proofs[i], certHashes[i], root, sha256))
        }

        for (let i = 0;i < JSONDATA.length;++i){
            var newdegree = new degree({
                degree: JSONDATA[i]
            });
            newdegree.save(function (err, result) {
                if (err) {
                    console.log(err);
                    throw err;
                } else {
                    console.log(result);
                }
            });
        }

        console.log("Publishing root on Blockchain")
        fromPubKey = process.env.WALLET_ADDRESS
        fromPvtKey = process.env.WALLET_PRIVATE_KEY
        toPubKey = process.env.DESTINATION_WALLET_ADDRESS
        const txid = blockchain.publishOnBlockchain(root.toString('hex'), fromPvtKey, fromPubKey, toPubKey, 5)
        console.log(txid)

        for (let i = 0;i < JSONDATA.length;++i){
            JSONDATA[i]['instituteTxId'] = txid
            console.log("Certificates with transactions " + i + "\n")
            console.log(JSONDATA[i])
        }

    })
    res.redirect('back')
}


module.exports.VerifyDegree = function(req, res){
    // root will actually be obtained from the transaction (op return field) from institute's public key to itself
    /*  
        Steps:
        1. get certificate from db using degree id
        2. get institute public key from degree
        3. ensure that it is verified by HEC
        4. verify its proof 
    */
    degreeid = req.params.degreeid
    root = "e9e656451007174ea2b2c472bfb9ae9c833cd16bf5d3c2a677aed05d160dbcd0"
    hash = "fe1819312c91efc975040ad0bd9eedd01fa7701a0a96f8df26c861bc1cd006c6"
    degree.findById(degreeid, function(err, res2){
        if (err){
            console.log(err)
        } else{
            console.log("Verifying!")
            proof = res2.degree[0].Proof
            console.log(proof)
            var data = []
            proof.forEach(e => {
                data.push( JSON.stringify(e))
            })


            console.log(data)
            data = data.map(x => new Buffer(x, 'hex'))
            console.log(data.map(x => x && x.toString('hex')))
            // proof = proof[0].map(x => new Buffer(x, 'hex'))
            // console.log(proof.map(x => x && x.toString('hex')))
            console.log(merkleProof.verify(data, new Buffer(hash, 'hex'), new Buffer(root, 'hex'), sha256))
            res.send(data.map(x => x && x.toString('hex')))
        }
    })
}


module.exports.sendEmail = function (req, res) {
    console.log("Send Email!");
    var emails = [];
    student.find({InstituteID: req.session.uid}, {_id: 0, data: 1}, function(err, arr){
        data_arr = arr.map( function(u) { return u.data; } );
        for (i = 0;i < data_arr.length;i++){
            for (j = 0;j < data_arr[i].length;j++){
                emails.push(data_arr[i][j].Email);
            }
        }
        if (emails.length == 0){
            console.log("No recipients found for sending Invites!");
            return;
        }
        email_str = emails.toString();
        console.log(email_str);

        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'edcertsweb@gmail.com',
              pass: 'blockchain'
            }
        });
          
        var mailOptions = {
            from: 'edcertsweb@gmail.com',
            to: email_str,
            subject: 'Invitation for receiving certificate | Edcerts',
            text: 'Dear user,\n\nYou have been sent an invitation to add the institute XYZ in Edcerts application. This will allow you to receive certificate from the institute. Please click on the below link to continue:\n\nhttps://edcert.herokuapp.com \n\nRegards,\nTeam Edcerts'
        };
          
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
        });
    });

    res.redirect('/Institute/Recipients')
}