"use strict";
const core = require("@actions/core");
const { App, LogLevel } = require("@slack/bolt");
const { WebClient } = require("@slack/web-api");

function generateRandomToken() {
    return Math.random().toString(36).substr(2, 10); // Generate a random alphanumeric token
}

const uniqueToken = generateRandomToken();

const token = process.env.SLACK_BOT_TOKEN || "";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const slackAppToken = process.env.SLACK_APP_TOKEN || "";
const channel_id = process.env.SLACK_CHANNEL_ID || "";
const environment = process.env.ENVIRONMENT || "";
const url = process.env.URL || "";
const app = new App({
    token: token,
    signingSecret: signingSecret,
    appToken: slackAppToken,
    socketMode: true,
    port: 3000,
    logLevel: LogLevel.DEBUG,
});

async function run() {
    try {
        const web = new WebClient(token);
        const github_server_url = process.env.GITHUB_SERVER_URL || "";
        const github_repos = process.env.GITHUB_REPOSITORY || "";
        const run_id = process.env.GITHUB_RUN_ID || "";
        const actionsUrl = `${github_server_url}/${github_repos}/actions/runs/${run_id}`;
        const runnerOS = process.env.RUNNER_OS || "";
        const actor = process.env.USER_ID || "";

        // Include the unique token in the Slack message
        await web.chat.postMessage({
            channel: channel_id,
            text: "GO TO PRODUCTION?",
            blocks: [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `Hey <@${actor}> 👋 Everything looks good! Do you want to go to prod? \nChoose "Go" when you are ready to release to production. Make sure your PR has all required approvals and can be merged. \nIf you choose "Stop" , the pipeline will stop.`,
                    },
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": `*Actions URL:*\n${actionsUrl}`,
                        },
                    ],
                },
                {
                    "type": "context",
                    "elements": [
                        {
                            "type": "mrkdwn",
                            "text": `Token: ${uniqueToken}`, // Include the unique token
                        },
                    ],
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Go",
                            },
                            "style": "primary",
                            "value": "approve",
                            "action_id": "slack-approval-approve",
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Stop",
                            },
                            "style": "danger",
                            "value": "reject",
                            "action_id": "slack-approval-reject",
                        },
                    ],
                },
            ],
        });

        app.action("slack-approval-approve", ({ ack, client, body, logger }) => {
            const responseToken = body.message.blocks.find(
                (block) =>
                    block.type === "context" &&
                    block.elements[0].text.includes("Token:")
            );
            if (responseToken) {
                const receivedToken = responseToken.elements[0].text
                    .split("Token: ")[1]
                    .trim();
                if (receivedToken === uniqueToken) {
                    ack();
                    try {
                        const response_blocks = body.message.blocks;
                        response_blocks.pop();
                        response_blocks.push({
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: `Approved by <@${body.user.id}>`,
                            },
                        });
                        client.chat.update({
                            channel: body.channel.id || "",
                            ts: body.message.ts || "",
                            blocks: response_blocks,
                        });
                    } catch (error) {
                        logger.error(error);
                    }
                    process.exit(0);
                } else {
                    logger.error("Invalid token in response. Ignoring the response.");
                }
            } else {
                logger.error("Token not found in response. Ignoring the response.");
            }
        });

        app.action("slack-approval-reject", ({ ack, client, body, logger }) => {
            ack();
            try {
                const response_blocks = body.message.blocks;
                response_blocks.pop();
                response_blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `Rejected by <@${body.user.id}>`,
                    },
                });
                client.chat.update({
                    channel: body.channel.id || "",
                    ts: body.message.ts || "",
                    blocks: response_blocks,
                });
            } catch (error) {
                logger.error(error);
            }
            process.exit(1);
        });
    } catch (error) {
        if (error instanceof Error) core.setFailed(error.message);
    }
}

run();
app.start(3000); // Start the Slack Bolt app
console.log("Waiting Approval reaction.....");
