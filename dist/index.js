"use strict";

const { App, LogLevel } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const core = require('@actions/core');

const token = process.env.SLACK_BOT_TOKEN || "";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const slackAppToken = process.env.SLACK_APP_TOKEN || "";
const channel_id = process.env.SLACK_CHANNEL_ID || "";
const environment = process.env.ENVIRONMENT || "";
const url = process.env.URL || "";
const sign_token = crypto.randomBytes(16).toString('hex');
let waitingForResponse = true;

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

        async function sendApprovalMessage() {
            await web.chat.postMessage({
                channel: channel_id,
                text: "GO TO PRODUCTION?",
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Hey <@${actor}> 👋 Everything looks good! Do you want to go to prod? \nChoose "Go" when you are ready to release to production. Make sure your PR has all required approvals and can be merged. \nIf you choose "Stop", the pipeline will stop.`,
                        }
                    },
                    {
                        type: "section",
                        fields: [
                            {
                                type: "mrkdwn",
                                text: `*Actions URL:*\n${actionsUrl}`
                            },
                            {
                                type: "mrkdwn",
                                text: `*Token:*\n${sign_token}`
                            }
                        ]
                    },
                    {
                        type: "actions",
                        elements: [
                            {
                                type: "button",
                                text: {
                                    type: "plain_text",
                                    emoji: true,
                                    text: "Go"
                                },
                                style: "primary",
                                value: "approve",
                                action_id: "slack-approval-approve"
                            },
                            {
                                type: "button",
                                text: {
                                    type: "plain_text",
                                    emoji: true,
                                    text: "Stop"
                                },
                                style: "danger",
                                value: "reject",
                                action_id: "slack-approval-reject"
                            }
                        ]
                    }
                ]
            });
        }

        sendApprovalMessage();

        function checkForResponse() {
            checkForApprovalResponse();
            checkForRejectResponse();
        }

        checkForResponse();
    } catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}

function extractTokenFromBlocks(blocks) {
    const tokenBlock = blocks.find(block => {
        return block.type === 'section' && block.fields && block.fields.some(field => field.text.includes('*Token:*'));
    });

    if (tokenBlock) {
        const tokenField = tokenBlock.fields.find(field => field.text.includes('*Token:*'));
        const tokenText = tokenField.text.split('\n')[1];
        const token = tokenText.trim();
        return token;
    }

    return null;
}

function checkForApprovalResponse() {
    app.action('slack-approval-approve', async ({ ack, client, body, logger }) => {
        await ack();

        if (waitingForResponse) {
            const response_blocks = body.message?.blocks;
            const responseToken = extractTokenFromBlocks(response_blocks);

            if (responseToken === sign_token) {
                response_blocks.pop();
                response_blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `Approved by <@${body.user.id}>`,
                    },
                });
                await client.chat.update({
                    channel: body.channel?.id || "",
                    ts: body.message?.ts || "",
                    blocks: response_blocks
                });
                process.exit(0);
            } else {
                console.log('Token does not match. Waiting for another response...');
                checkForApprovalResponse();
            }
        }
    });
}

function checkForRejectResponse() {
    app.action('slack-approval-reject', async ({ ack, client, body, logger }) => {
        await ack();

        if (waitingForResponse) {
            const response_blocks = body.message?.blocks;
            const responseToken = extractTokenFromBlocks(response_blocks);

            if (responseToken === sign_token) {
                response_blocks.pop();
                response_blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `Rejected by <@${body.user.id}>`,
                    },
                });
                await client.chat.update({
                    channel: body.channel?.id || "",
                    ts: body.message?.ts || "",
                    blocks: response_blocks
                });
                process.exit(1);
            } else {
                console.log('Token does not match. Waiting for another response...');
                checkForRejectResponse();
            }
        }
    });
}

run();
