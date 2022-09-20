//========//IMPORTS//========//
const utils = require('../utils/utils');
//----prisma
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

//================//COMMENTAIRES//================//

//========//CREER
exports.commentPost = async (req, res, next) => {
    const findPost = utils.findPost({id : Number(req.params.id)})
    const findUser = utils.findUser({id : req.auth.userId})

    if ((findPost.isActive) && (findUser.isActive)) {
        // enregistrement
        await prisma.comment.create({
            data : {
                text : req.body.text,
                postId : Number(req.params.id),
                userId : req.auth.userId
            }
        })
        .then(async () => { await prisma.$disconnect() })
        .then(() => res.status(201).json({ message : 'commentaire publie !' }))
        .catch(error => console.log(error) || res.status(400).json({ message : error }))
    } else {
        return res.status(401).json({ message : 'Acces non authorise' });
    }
};

//========//AFFICHER
exports.getPostComments = async (req, res, next) => {
    // recherche
    await prisma.comment.findMany({
        where : {
            postId : Number(req.params.id),
            isActive : true
        }
    })
    .then(comments => res.status(200).json(comments))
    .then(async () => { await prisma.$disconnect() })
    .catch(error => console.log(error) || res.status(400).json({ message : error }));
}

//========//UN SEUL
exports.getOneComment = async (req, res, next) => {
    // recherche
    utils.comment({id : Number(req.params.id)})
    .then(comment => res.status(200).json(comment))
    .then(async () => { await prisma.$disconnect() })
    .catch(error => console.log(error) || res.status(404).json({ message : error }));
};

//========//MODIFIER
exports.modifyComment = async (req, res, next) => {
    // Recherche
    utils.comment({id : Number(req.params.id)})
    .then(async comment => {
        // verification utilisateur
        const findUser = utils.findUser({id : req.auth.userId})
        
        if ((comment.userId === req.auth.userId) && (findUser.isActive)) {
            
            // enregistrement
            await prisma.comment.update({
                where : {
                    id : Number(req.params.id)
                },
                data : {
                    text : req.body.text
                }
            })
            .then(async () => { await prisma.$disconnect() })
            .then(() => res.status(200).json({ message : 'Commentaire modifie !' }))
            .catch(error => console.log(error) || res.status(401).json({ message : error }));

        } else {
            return res.status(401).json({ message : 'Acces non authorise' })
        }
    })
    .catch(error => console.log(error) || res.status(500).json({ message : error }));
}

//========//SUPPRIMER
exports.delComment = async (req, res, next) => {
    //---Quel utilisateur ?
    //------ADMINISTRATEUR
    if (req.auth.isAdmin === true) {
        utils.findUser({id : req.auth.userId})
        .then(async admin => {
            // verification administrateur
            if ((req.auth.userId === admin.id) && (admin.isActive === true) && (admin.isAdmin === true)) {
                
                // enregistrement
                await prisma.comment.delete({
                    where : { id : Number(req.params.id) }
                })
                .then(async () => { await prisma.$disconnect() })
                .then(() => res.status(200).json({ message : 'commentaire supprime !' }))
                .catch(error => res.status(401).json({ message : error }))

            } else {
                return res.status(401).json({ message : 'Acces non authorise' })
            }
        })
    }
    //------UTILISATEUR NORMAL
    else {
        // Recherche dans le post
        utils.comment({id : Number(req.params.id)})
        .then(async comment => {
            // verification utilisateur
            const findUser = utils.findUser({id : req.auth.userId})
            if ((comment.userId === req.auth.userId) && (findUser.isActive)) {
                // enregistrement
                await prisma.comment.delete({
                    where : { id : Number(req.params.id) }
                })
                .then(async () => { await prisma.$disconnect() })
                .then(() => res.status(200).json({ message : 'commentaire supprime !' }))
                .catch(error => res.status(401).json({ message : error }))
            } else {
                return res.status(401).json({ message : 'Acces non authorise' })
            }
        })
        .catch(error => res.status(500).json({ message : error }));
    }
}
