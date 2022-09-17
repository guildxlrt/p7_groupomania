//---IMPORTS
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pwVal = require("password-validator");
// prisma
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

//--------CONFIG
// EMAIL
const emailValidator = new RegExp(/^([a-z0-9._-]+)@([a-z0-9]+)\.([a-z]{2,8})(\.[a-z]{2,8})?$/, 'g');
        
// PASSWORD
const pwValSchema = new pwVal();
pwValSchema
.is().min(8)                                    // Minimum length 8
.is().max(100)                                  // Maximum length 100
.has().uppercase(2)                              // Must have uppercase letters
.has().lowercase(2)                              // Must have lowercase letters
.has().digits(2)                                // Must have at least 2 digits
.has().not().spaces()                           // Should not have spaces
.is().not().oneOf(['Passw0rd', 'Password123']); // Blacklist these values

//----------------------------------------------------------------------//
//------------PROGRAMS-------------------------------------------------//

// NOUVEAU
exports.signup = (req, res, next) => {
    (function reqValidation() {
        //---ACCEPT
        if ((emailValidator.test(req.body.email)) && (pwValSchema.validate(req.body.password))) {
            bcrypt.hash(req.body.password, 10)
            .then(async hash => {
                // enregistrement
                await prisma.user.create({
                    data : {
                        email : req.body.email,
                        password : hash,
                        name : req.body.name,
                        surname : req.body.surname,
                        birthday : req.body.birthday,
                    }
                })
                .then(async () => { await prisma.$disconnect() })
                .then(() => res.status(201).json({ message : 'utilisateur cree !' }))
                .catch(error => console.log(error) || res.status(400).json({message : error}))
            })
            .catch(error => console.log(error) || res.status(500).json({ message : error }));
        }
        //---REJET
        // Email
        else if ((emailValidator.test(req.body.email)) === false && (pwValSchema.validate(req.body.password)) === true) {
            return res.status(400).json({ message : "l'email doit etre au format email : jack.nicholson@laposte.fr, sasha93.dupont@yahoo.fr, kanap-service_client@kanap.co.fr ..." })
        }
        // Mot De Passe
        else if ((emailValidator.test(req.body.email)) === true && (pwValSchema.validate(req.body.password)) === false) {
            return res.status(400).json({ message : "le mot de passe n'est pas assez fort : il doit contenir au minimum 2 chiffres, 2 minuscules et 2 majuscules; il doit etre d'une longueur minimum de 8 caracteres" })
        }
        // les deux
        else if ((emailValidator.test(req.body.email)) === false && (pwValSchema.validate(req.body.password)) === false) {
            return res.status(400).json({ message : "informations incorrectes" })
        }
    })();
};


// CONNEXION
exports.login = async (req, res, next) => {
    await prisma.user.findUnique({ 
        where : {
            email : req.body.email
        }
    })
    .then(async user => {
        // mauvais utilisateur
        if (user) {
            // bon utilisateur
            await bcrypt.compare(req.body.password, user.password)
            .then(valid => {
                if (valid) {
                    res.status(200).json({
                        userId : user.id,
                        token : jwt.sign(
                            {userId : user.id},
                            process.env.RANDOM_TOKEN,
                            { expiresIn : '24h'}
                        )
                    })
                }
                else {
                    res.status(401).json({ message : 'Paire login/mot de passe incorrecte' });
                }
            })
            .catch(error => console.log(error) || res.status(500).json({ message : error }));
        }
        else {
            // le message d'erreur est volontairement flou (fuite d'erreur)
            return res.status(401).json({ message : 'Paire login/mot de passe incorrecte' });
        }
    })
    .catch(error => console.log(error) || res.status(500).json({ message : error }));
};

// MODIFICATIONS
exports.update = async (req, res, next) => {
    // Recherche de l'utilisateur
    await prisma.user.findUnique({
        where : {
            id : req.auth.userId
        }
    })
    .then(async user => {
        // verification utilisateur
        if (user.id === req.auth.userId) {
            // verification pass
            await bcrypt.compare(req.body.password, user.password)
            .then(async valid => {
                if (valid) {
                    // enregistrement
                    await prisma.user.update({
                        where : {
                            id : req.auth.userId
                        },
                        data : {
                            email : req.body.updates.email,
                            name : req.body.updates.name,
                            surname : req.body.updates.surname,
                            birthday : req.body.updates.bithday
                        }
                    })
                    .then(async () => { await prisma.$disconnect() })
                    .then(() => res.status(200).json({ message : 'utilisateur modifie !' }))
                    .catch(error => console.log(error) || res.status(401).json({ message : error }));
                } else {
                    res.status(401).json({ message : 'Acces non authorise' });
                }
            })
            .catch(error => console.log(error) || res.status(500).json({ message : error }));
        } else {
            return res.status(401).json({ message : 'Acces non authorise' });
        }
    })
    .catch(error => console.log(error) || res.status(500).json({ message : error }));
}

// CHANGER MDP
exports.password = async (req, res, next) => {
    // Recherche de l'utilisateur
    await prisma.user.findUnique({
        where : {
            id : req.auth.userId
        }
    })
    //-----VERIFICATION
    .then(async user => {
        // utilisateur
        if (user.id === req.auth.userId) {
            // ancient pass
            await bcrypt.compare(req.body.password, user.password)
            .then(async valid => {
                if (valid) {
                    // nouveau pass
                    if (req.body.password != req.body.newPass && req.body.newPass === req.body.passConfirm && pwValSchema.validate(req.body.newPass)) {
                        bcrypt.hash(req.body.passConfirm, 10)
                        .then(async hash => {
                            // enregistrement du nouveau mot de passe
                            await prisma.user.update({
                                where : {
                                    id : req.auth.userId
                                },
                                data : {
                                    password : hash
                                }
                            })
                            .then(async () => { await prisma.$disconnect() })
                            .then(() => res.status(200).json({ message : 'mot de passe modifie !' }))
                            .catch(error => console.log(error) || res.status(401).json({ message : error }));
                        })
                    }
                    // RENOUVELLEMENT
                    else if (req.body.password === req.body.newPass) {
                        return res.status(400).json({ message : "Le nouveau mot de passe doit differer du nouveau." });
                    }
                    // CONCORDANCE
                    else if (req.body.newPass != req.body.passConfirm) {
                        return res.status(400).json({ message : "Les saisies du mot de passe doivent correspondre." });
                    }
                    // FORCE
                    else if (!(pwValSchema.validate(req.body.newPass))) {
                        return res.status(400).json({ message : "Le mot de passe n'est pas assez fort : il doit contenir au minimum 2 chiffres, 2 minuscules et 2 majuscules; il doit etre d'une longueur minimum de 8 caracteres." });
                    }
                } else {
                    res.status(401).json({ message : 'Acces non authorisE' })
                }
            })
            .catch(error => console.log(error) || res.status(500).json({ message : error }));
        } else {
            return res.status(401).json({ message : 'Acces non authorise' });
        }
    })
    .catch(error => console.log(error) || res.status(500).json({ message : error }));
}

// CHANGER AVATAR
exports.avatar = (req, res, next) => {
    res.status(400).json({message : "Test avatar"})
}

// DESACTIVER
exports.disable = async (req, res, next) => {
    // Recherche de l'utilisateur
    await prisma.user.findUnique({
        where : {
            id : req.auth.userId
        }
    })
    .then(async user => {
        // verification utilisateur
        if ((req.auth.userId === user.id) && (user.isActive === true)) {
            // saisie email
            if (req.body.email === user.email) {
                // mot de passe
                await bcrypt.compare(req.body.password, user.password)
                .then(valid => {
                    if (valid) {
                        // enregistrement
                        prisma.user.update({
                            where : {
                                id : req.auth.userId
                            },
                            data : {
                                isActive : false
                            }
                        })
                        .then(async () => { await prisma.$disconnect() })
                        .then(() => res.status(200).json({ message : 'Compte desactive' }))
                        .catch(error => console.log(error) || res.status(401).json({ message : error }))
                    }
                })
                .catch(error => console.log(error) || res.status(500).json({ message : error }));
            } else {
                res.status(401).json({ message : "l'email ne correspond pas" })
            }
        } else {
            res.status(401).json({ message : 'Acces non authorise' });
        }
    })
    .catch(error => console.log(error) || res.status(500).json({ message : error }));
}