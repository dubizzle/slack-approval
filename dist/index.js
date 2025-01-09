"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const bolt_1 = require("@slack/bolt");
const web_api_1 = require("@slack/web-api");
const token = process.env.SLACK_BOT_TOKEN || "";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const slackAppToken = process.env.SLACK_APP_TOKEN || "";
const channel_id = process.env.SLACK_CHANNEL_ID || "";
const uniqueToken = generateRandomToken();
const app = new bolt_1.App({
    token: token,
    signingSecret: signingSecret,
    appToken: slackAppToken,
    socketMode: true,
    port: 3000,
    logLevel: bolt_1.LogLevel.DEBUG,
});

function generateRandomToken() {
    return Math.random().toString(36).substring(2, 10); // Generate a random alphanumeric token
}

function isUniqueTokenValid(text) {
    return text === `Unique Token: ${uniqueToken}`;
}

function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const web = new web_api_1.WebClient(token);
            const github_server_url = process.env.GITHUB_SERVER_URL || "";
            const github_repos = process.env.GITHUB_REPOSITORY || "";
            const run_id = process.env.GITHUB_RUN_ID || "";
            const actionsUrl = `${github_server_url}/${github_repos}/actions/runs/${run_id}`;
            const runnerOS = process.env.RUNNER_OS || "";
            const actor = process.env.USER_NAME || "";
            const failed_tests = process.env.FAILED_TESTS || "";
            (() => __awaiter(this, void 0, void 0, function* () {
                yield web.chat.postMessage({
                    channel: channel_id,
                    text: "GO TO PRODUCTION?",
                    blocks: [
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": `Hey ${actor} 👋 Do you want to rerun the whole test suit or only the failed tests which are: ${failed_tests}? \nChoose one of the following options:`
                            }
                        },
                        {
                            "type": "context",
                            "elements": [
                                {
                                    "type": "mrkdwn",
                                    "text": `Unique Token: ${uniqueToken}` // Include the unique token
                                }
                            ]
                        },
                        {
                            "type": "actions",
                            "elements": [
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "Run only failed tests"
                                    },
                                    "style": "primary",
                                    "value": "option_1",
                                    "action_id": "slack-option-1"
                                },
                                {
                                    "type": "button",
                                    "text": {
                                        "type": "plain_text",
                                        "emoji": true,
                                        "text": "2"
                                    },
                                    "style": "default",
                                    "value": "Run all tests",
                                    "action_id": "slack-option-2"
                                }
                            ]
                        }
                    ]
                });
            }))();
            app.action('slack-option-1', ({ ack, client, body, logger }) => __awaiter(this, void 0, void 0, function* () {
                const elements = body.message.blocks[1].elements;
                const retrieved_token = elements[0].text;
                if (!isUniqueTokenValid(retrieved_token)) {
                    console.log('Invalid token:', uniqueToken);
                    return ack();
                }
                yield ack();
                try {
                    yield client.chat.update({
                        channel: body.channel.id,
                        ts: body.message.ts,
                        text: `Option 1 selected by <@${body.user.id}>`
                    });
                    console.log("Option 1 selected.");
                    core.exportVariable('USER_CHOICE', '1'); // Export USER_CHOICE as 2
                    process.exit(0);
                } catch (error) {
                    logger.error(error);
                }
            }));

            app.action('slack-option-2', ({ ack, client, body, logger }) => __awaiter(this, void 0, void 0, function* () {
                const elements = body.message.blocks[1].elements;
                const retrieved_token = elements[0].text;
                if (!isUniqueTokenValid(retrieved_token)) {
                    console.log('Invalid token:', uniqueToken);
                    return ack();
                }
                yield ack();
                try {
                    yield client.chat.update({
                        channel: body.channel.id,
                        ts: body.message.ts,
                        text: `Option 2 selected by <@${body.user.id}>`
                    });
                    console.log("Option 2 selected.");
                    core.exportVariable('USER_CHOICE', '2'); // Export USER_CHOICE as 2
                    process.exit(0);
                } catch (error) {
                    logger.error(error);
                }
            }));
            (() => __awaiter(this, void 0, void 0, function* () {
                yield app.start(3000);
                console.log('Waiting Approval reaction.....');
            }))();
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
run();
