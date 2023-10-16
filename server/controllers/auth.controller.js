const JWT = require("jsonwebtoken");
const randomString = require("randomstring");
const UserModel = require("../models/user.model");
const TokenModel = require("../models/token.model");
const Config = require("../configs/config");
const HGenerator = require("../helper/generator.helper");
const HMail = require("../helper/mail.helper");

class AuthController {
    static async register(req, res) {
        try {
            const { email } = req.body;
            const origin = req.headers.origin;
            const user = await UserModel.findOne({ email: email });
            if (!user) {
                const token = HGenerator.generateToken(
                    { email: email },
                    process.env.NODE_TOKEN_SECRET,
                    "5m",
                );
                const registerLink = `${origin}/register?t=${token}`;
                // const registerLink = `http://localhost:8080/api/auth/register?t=${token}`;
                await HMail.send(
                    email,
                    "Register",
                    HMail.template.register,
                    registerLink,
                );
            }
            return res.status(200).json("Check you mail - Register");
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
    static async registerWithLink(req, res) {
        try {
            const token = req.query?.t;
            const data = JWT.verify(token, process.env.NODE_TOKEN_SECRET);
            const email = data.email;
            const user = await UserModel.findOne({ email: email });
            if (!user) {
                const secret = randomString.generate();
                const newUser = new UserModel({
                    email: email,
                    secret: secret,
                });
                await newUser.save();
            }
            return res.status(201).json("Account created");
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
    static async login(req, res) {
        try {
            const { email } = req.body;
            const origin = req.headers.origin;
            const user = await UserModel.findOne({ email: email });
            if (user) {
                const userSecret = user.secret;
                const token = HGenerator.generateToken(
                    { id: user._id },
                    userSecret,
                    "5m",
                );
                const loginLink = `${origin}/login?i=${user._id}&t=${token}`;
                // const loginLink = `http://localhost:8080/api/auth/login?i=${user._id}&t=${token}`;
                await HMail.send(
                    email,
                    "Login",
                    HMail.template.login,
                    loginLink,
                );
            }
            return res.status(200).json("Check you mail - Login");
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
    static async loginWithLink(req, res) {
        try {
            const { i: userId, t: token } = req.query;
            const user = await UserModel.findById(userId);

            JWT.verify(token, user.secret);

            user.secret = randomString.generate();
            await user.save();
            const accessToken = HGenerator.generateAccessToken(
                {
                    userId: user._id,
                },
                "15m",
            );
            const refreshToken = HGenerator.generateRefreshToken(
                {
                    userId: user._id,
                },
                "7d",
            );
            const newRefreshToken = new TokenModel({
                user: user._id,
                refresh_token: refreshToken,
            });
            await newRefreshToken.save();

            return res
                .cookie("accessToken", accessToken, Config.cookie.options)
                .cookie("refreshToken", refreshToken, Config.cookie.options)
                .status(200)
                .json({ userId: user._id });
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
    static async refreshToken(req, res) {
        const { refreshToken } = req.cookies;
        if (!refreshToken) return res.status(401).json("Unauthorized 1");

        try {
            const { userId } = req.params;

            const [existToken] = await TokenModel.find({ user: userId })
                .sort({ createdAt: -1 })
                .limit(1);
            if (!existToken) return res.status(401).json("Unauthorized 2");

            const isValidToken = await existToken.verify(refreshToken);
            if (!isValidToken) return res.status(403).json("Forbidden");

            JWT.verify(
                refreshToken,
                process.env.NODE_REFRESH_TOKEN_SECRET,
                async (error, payload) => {
                    if (error) return res.status(401).json("Failed 1");
                    if (payload.userId !== userId)
                        return res.status(401).json("Failed 2");

                    const accessToken = HGenerator.generateAccessToken(
                        {
                            userId: payload.userId,
                        },
                        "15m",
                    );
                    const refreshToken = HGenerator.generateRefreshToken(
                        {
                            userId: payload.userId,
                        },
                        "7d",
                    );

                    existToken.refresh_token = refreshToken;
                    await existToken.save();
                    return res
                        .cookie(
                            "refreshToken",
                            refreshToken,
                            Config.cookie.options,
                        )
                        .status(200)
                        .json({
                            userId: payload.userId,
                            accessToken,
                        });
                },
            );
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
    static async logout(req, res) {
        try {
            const { userId } = req.params;
            await TokenModel.deleteMany({ user: userId });
            return res
                .clearCookie("refreshToken")
                .clearCookie("accessToken")
                .status(200)
                .json("Successful");
        } catch (error) {
            return res.status(500).json(error.message);
        }
    }
}

module.exports = AuthController;
