// @ts-check
/** @type {import("@docusaurus/plugin-content-docs").SidebarsConfig} */
const typedocSidebar = {
  items: [
    {
      type: "category",
      label: "app",
      items: [
        {
          type: "category",
          label: "Variables",
          items: [
            {
              type: "doc",
              id: "api/app/variables/export=",
              label: "export="
            }
          ]
        }
      ],
      link: {
        type: "doc",
        id: "api/app/index"
      }
    },
    {
      type: "category",
      label: "config",
      items: [
        {
          type: "category",
          label: "database",
          items: [
            {
              type: "category",
              label: "Variables",
              items: [
                {
                  type: "doc",
                  id: "api/config/database/variables/export=",
                  label: "export="
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/config/database/index"
          }
        }
      ]
    },
    {
      type: "category",
      label: "controllers",
      items: [
        {
          type: "doc",
          id: "api/controllers/adminController/index",
          label: "adminController"
        },
        {
          type: "category",
          label: "authController",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/controllers/authController/functions/login",
                  label: "login"
                },
                {
                  type: "doc",
                  id: "api/controllers/authController/functions/logout",
                  label: "logout"
                },
                {
                  type: "doc",
                  id: "api/controllers/authController/functions/register",
                  label: "register"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/controllers/authController/index"
          }
        },
        {
          type: "doc",
          id: "api/controllers/commentController/index",
          label: "commentController"
        },
        {
          type: "doc",
          id: "api/controllers/conversationController/index",
          label: "conversationController"
        },
        {
          type: "category",
          label: "friendshipController",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/controllers/friendshipController/functions/listerAbonnements",
                  label: "listerAbonnements"
                },
                {
                  type: "doc",
                  id: "api/controllers/friendshipController/functions/listerAbonnes",
                  label: "listerAbonnes"
                },
                {
                  type: "doc",
                  id: "api/controllers/friendshipController/functions/listerAmis",
                  label: "listerAmis"
                },
                {
                  type: "doc",
                  id: "api/controllers/friendshipController/functions/neplusSuivre",
                  label: "neplusSuivre"
                },
                {
                  type: "doc",
                  id: "api/controllers/friendshipController/functions/suivre",
                  label: "suivre"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/controllers/friendshipController/index"
          }
        },
        {
          type: "doc",
          id: "api/controllers/hashtagController/index",
          label: "hashtagController"
        },
        {
          type: "doc",
          id: "api/controllers/messageController/index",
          label: "messageController"
        },
        {
          type: "doc",
          id: "api/controllers/notificationController/index",
          label: "notificationController"
        },
        {
          type: "doc",
          id: "api/controllers/postController/index",
          label: "postController"
        },
        {
          type: "category",
          label: "profileController",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/controllers/profileController/functions/getByPseudo",
                  label: "getByPseudo"
                },
                {
                  type: "doc",
                  id: "api/controllers/profileController/functions/getMe",
                  label: "getMe"
                },
                {
                  type: "doc",
                  id: "api/controllers/profileController/functions/updateMe",
                  label: "updateMe"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/controllers/profileController/index"
          }
        },
        {
          type: "doc",
          id: "api/controllers/reactionController/index",
          label: "reactionController"
        },
        {
          type: "doc",
          id: "api/controllers/reportController/index",
          label: "reportController"
        },
        {
          type: "doc",
          id: "api/controllers/userController/index",
          label: "userController"
        }
      ]
    },
    {
      type: "category",
      label: "middlewares",
      items: [
        {
          type: "doc",
          id: "api/middlewares/adminMiddleware/index",
          label: "adminMiddleware"
        },
        {
          type: "category",
          label: "authMiddleware",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/middlewares/authMiddleware/functions/export=",
                  label: "export="
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/middlewares/authMiddleware/index"
          }
        },
        {
          type: "doc",
          id: "api/middlewares/errorMiddleware/index",
          label: "errorMiddleware"
        },
        {
          type: "doc",
          id: "api/middlewares/uploadMiddleware/index",
          label: "uploadMiddleware"
        },
        {
          type: "doc",
          id: "api/middlewares/validationMiddleware/index",
          label: "validationMiddleware"
        }
      ]
    },
    {
      type: "category",
      label: "models",
      items: [
        {
          type: "doc",
          id: "api/models/commentModel/index",
          label: "commentModel"
        },
        {
          type: "doc",
          id: "api/models/conversationMemberModel/index",
          label: "conversationMemberModel"
        },
        {
          type: "doc",
          id: "api/models/conversationModel/index",
          label: "conversationModel"
        },
        {
          type: "category",
          label: "friendshipModel",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/models/friendshipModel/functions/listerAbonnements",
                  label: "listerAbonnements"
                },
                {
                  type: "doc",
                  id: "api/models/friendshipModel/functions/listerAbonnes",
                  label: "listerAbonnes"
                },
                {
                  type: "doc",
                  id: "api/models/friendshipModel/functions/listerAmis",
                  label: "listerAmis"
                },
                {
                  type: "doc",
                  id: "api/models/friendshipModel/functions/neplusSuivre",
                  label: "neplusSuivre"
                },
                {
                  type: "doc",
                  id: "api/models/friendshipModel/functions/sontAmis",
                  label: "sontAmis"
                },
                {
                  type: "doc",
                  id: "api/models/friendshipModel/functions/suivre",
                  label: "suivre"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/models/friendshipModel/index"
          }
        },
        {
          type: "doc",
          id: "api/models/hashtagModel/index",
          label: "hashtagModel"
        },
        {
          type: "doc",
          id: "api/models/messageModel/index",
          label: "messageModel"
        },
        {
          type: "doc",
          id: "api/models/notificationModel/index",
          label: "notificationModel"
        },
        {
          type: "doc",
          id: "api/models/postModel/index",
          label: "postModel"
        },
        {
          type: "category",
          label: "profileModel",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/models/profileModel/functions/createProfile",
                  label: "createProfile"
                },
                {
                  type: "doc",
                  id: "api/models/profileModel/functions/getProfileByPseudo",
                  label: "getProfileByPseudo"
                },
                {
                  type: "doc",
                  id: "api/models/profileModel/functions/getProfileByUserId",
                  label: "getProfileByUserId"
                },
                {
                  type: "doc",
                  id: "api/models/profileModel/functions/updateProfile",
                  label: "updateProfile"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/models/profileModel/index"
          }
        },
        {
          type: "doc",
          id: "api/models/reactionModel/index",
          label: "reactionModel"
        },
        {
          type: "doc",
          id: "api/models/reportModel/index",
          label: "reportModel"
        },
        {
          type: "category",
          label: "userModel",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/models/userModel/functions/createUser",
                  label: "createUser"
                },
                {
                  type: "doc",
                  id: "api/models/userModel/functions/findByEmail",
                  label: "findByEmail"
                },
                {
                  type: "doc",
                  id: "api/models/userModel/functions/findById",
                  label: "findById"
                },
                {
                  type: "doc",
                  id: "api/models/userModel/functions/findByPseudo",
                  label: "findByPseudo"
                },
                {
                  type: "doc",
                  id: "api/models/userModel/functions/updateLastLogin",
                  label: "updateLastLogin"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/models/userModel/index"
          }
        }
      ]
    },
    {
      type: "category",
      label: "routes",
      items: [
        {
          type: "doc",
          id: "api/routes/adminRoutes/index",
          label: "adminRoutes"
        },
        {
          type: "category",
          label: "authRoutes",
          items: [
            {
              type: "category",
              label: "Variables",
              items: [
                {
                  type: "doc",
                  id: "api/routes/authRoutes/variables/export=",
                  label: "export="
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/routes/authRoutes/index"
          }
        },
        {
          type: "doc",
          id: "api/routes/commentRoutes/index",
          label: "commentRoutes"
        },
        {
          type: "doc",
          id: "api/routes/conversationRoutes/index",
          label: "conversationRoutes"
        },
        {
          type: "category",
          label: "friendshipRoutes",
          items: [
            {
              type: "category",
              label: "Variables",
              items: [
                {
                  type: "doc",
                  id: "api/routes/friendshipRoutes/variables/export=",
                  label: "export="
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/routes/friendshipRoutes/index"
          }
        },
        {
          type: "doc",
          id: "api/routes/hashtagRoutes/index",
          label: "hashtagRoutes"
        },
        {
          type: "doc",
          id: "api/routes/messageRoutes/index",
          label: "messageRoutes"
        },
        {
          type: "doc",
          id: "api/routes/notificationRoutes/index",
          label: "notificationRoutes"
        },
        {
          type: "doc",
          id: "api/routes/postRoutes/index",
          label: "postRoutes"
        },
        {
          type: "category",
          label: "profileRoutes",
          items: [
            {
              type: "category",
              label: "Variables",
              items: [
                {
                  type: "doc",
                  id: "api/routes/profileRoutes/variables/export=",
                  label: "export="
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/routes/profileRoutes/index"
          }
        },
        {
          type: "doc",
          id: "api/routes/reactionRoutes/index",
          label: "reactionRoutes"
        },
        {
          type: "doc",
          id: "api/routes/reportRoutes/index",
          label: "reportRoutes"
        },
        {
          type: "doc",
          id: "api/routes/userRoutes/index",
          label: "userRoutes"
        }
      ]
    },
    {
      type: "doc",
      id: "api/server/index",
      label: "server"
    },
    {
      type: "category",
      label: "services",
      items: [
        {
          type: "doc",
          id: "api/services/adminService/index",
          label: "adminService"
        },
        {
          type: "category",
          label: "authService",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/services/authService/functions/login",
                  label: "login"
                },
                {
                  type: "doc",
                  id: "api/services/authService/functions/register",
                  label: "register"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/services/authService/index"
          }
        },
        {
          type: "doc",
          id: "api/services/commentService/index",
          label: "commentService"
        },
        {
          type: "doc",
          id: "api/services/conversationService/index",
          label: "conversationService"
        },
        {
          type: "category",
          label: "friendshipService",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/services/friendshipService/functions/listerAbonnements",
                  label: "listerAbonnements"
                },
                {
                  type: "doc",
                  id: "api/services/friendshipService/functions/listerAbonnes",
                  label: "listerAbonnes"
                },
                {
                  type: "doc",
                  id: "api/services/friendshipService/functions/listerAmis",
                  label: "listerAmis"
                },
                {
                  type: "doc",
                  id: "api/services/friendshipService/functions/neplusSuivre",
                  label: "neplusSuivre"
                },
                {
                  type: "doc",
                  id: "api/services/friendshipService/functions/sontAmis",
                  label: "sontAmis"
                },
                {
                  type: "doc",
                  id: "api/services/friendshipService/functions/suivre",
                  label: "suivre"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/services/friendshipService/index"
          }
        },
        {
          type: "doc",
          id: "api/services/hashtagService/index",
          label: "hashtagService"
        },
        {
          type: "doc",
          id: "api/services/messageService/index",
          label: "messageService"
        },
        {
          type: "doc",
          id: "api/services/notificationService/index",
          label: "notificationService"
        },
        {
          type: "doc",
          id: "api/services/postService/index",
          label: "postService"
        },
        {
          type: "category",
          label: "profileService",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/services/profileService/functions/getMyProfile",
                  label: "getMyProfile"
                },
                {
                  type: "doc",
                  id: "api/services/profileService/functions/getPublicProfile",
                  label: "getPublicProfile"
                },
                {
                  type: "doc",
                  id: "api/services/profileService/functions/updateMyProfile",
                  label: "updateMyProfile"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/services/profileService/index"
          }
        },
        {
          type: "doc",
          id: "api/services/reactionService/index",
          label: "reactionService"
        },
        {
          type: "doc",
          id: "api/services/reportService/index",
          label: "reportService"
        },
        {
          type: "doc",
          id: "api/services/userService/index",
          label: "userService"
        }
      ]
    },
    {
      type: "category",
      label: "utils",
      items: [
        {
          type: "doc",
          id: "api/utils/imageUtils/index",
          label: "imageUtils"
        },
        {
          type: "category",
          label: "passwordUtils",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/utils/passwordUtils/functions/comparePassword",
                  label: "comparePassword"
                },
                {
                  type: "doc",
                  id: "api/utils/passwordUtils/functions/hashPassword",
                  label: "hashPassword"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/utils/passwordUtils/index"
          }
        },
        {
          type: "category",
          label: "tokenUtils",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/utils/tokenUtils/functions/createToken",
                  label: "createToken"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/utils/tokenUtils/index"
          }
        },
        {
          type: "category",
          label: "validationUtils",
          items: [
            {
              type: "category",
              label: "Functions",
              items: [
                {
                  type: "doc",
                  id: "api/utils/validationUtils/functions/sanitizeText",
                  label: "sanitizeText"
                },
                {
                  type: "doc",
                  id: "api/utils/validationUtils/functions/validateBirthDate",
                  label: "validateBirthDate"
                },
                {
                  type: "doc",
                  id: "api/utils/validationUtils/functions/validateEmail",
                  label: "validateEmail"
                },
                {
                  type: "doc",
                  id: "api/utils/validationUtils/functions/validatePassword",
                  label: "validatePassword"
                },
                {
                  type: "doc",
                  id: "api/utils/validationUtils/functions/validatePseudo",
                  label: "validatePseudo"
                }
              ]
            }
          ],
          link: {
            type: "doc",
            id: "api/utils/validationUtils/index"
          }
        }
      ]
    }
  ]
};
module.exports = typedocSidebar.items;