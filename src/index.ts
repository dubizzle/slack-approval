import * as core from '@actions/core'
import { App, BlockAction, LogLevel } from '@slack/bolt'
import { WebClient } from '@slack/web-api'

const token = process.env.SLACK_BOT_TOKEN || ""
const signingSecret =  process.env.SLACK_SIGNING_SECRET || ""
const slackAppToken = process.env.SLACK_APP_TOKEN || ""
const channel_id    = process.env.SLACK_CHANNEL_ID || ""
const environment   = process.env.ENVIRONMENT || ""
const url           = process.env.URL || ""

const app = new App({
  token: token,
  signingSecret: signingSecret,
  appToken: slackAppToken,
  socketMode: true,
  port: 3000,
  logLevel: LogLevel.DEBUG,
});

async function run(): Promise<void> {
  try {
    const web = new WebClient(token);

    const github_server_url = process.env.GITHUB_SERVER_URL || "";
    const github_repos = process.env.GITHUB_REPOSITORY || "";
    const run_id = process.env.GITHUB_RUN_ID || "";
    const actionsUrl = `${github_server_url}/${github_repos}/actions/runs/${run_id}`;
    const runnerOS   = process.env.RUNNER_OS || "";
    const actor      = process.env.USER_NAME || "";

    // Optional context, rendered only when provided by the calling workflow
    const service   = process.env.SERVICE_NAME || "";
    const namespace = process.env.NAMESPACE || "";
    const scope     = process.env.SCOPE || "";
    const changes   = process.env.CHANGES || "";

    const fields: any[] = [];
    if (actor)       fields.push({ "type": "mrkdwn", "text": `*Requested by:*\n${actor}` });
    if (service)     fields.push({ "type": "mrkdwn", "text": `*Service:*\n\`${service}\`` });
    if (environment) fields.push({ "type": "mrkdwn", "text": `*Environment:*\n\`${environment}\`` });
    if (namespace)   fields.push({ "type": "mrkdwn", "text": `*Namespace:*\n\`${namespace}\`` });
    if (scope)       fields.push({ "type": "mrkdwn", "text": `*Scope:*\n${scope}` });
    fields.push({ "type": "mrkdwn", "text": `*Actions URL:*\n${actionsUrl}` });

    const detailBlocks: any[] = [
      { "type": "section", "fields": fields },
    ];
    if (changes) {
      detailBlocks.push({
        "type": "section",
        "text": {
          "type": "mrkdwn",
          // Slack section text is capped at 3000 chars
          "text": `*Requested changes:*\n\`\`\`${changes.slice(0, 2800)}\`\`\``,
        },
      });
    }

    (async () => {
      await web.chat.postMessage({
        channel: channel_id,
        text: "ConfigMap Manager — Approval Required",
        blocks: [
            {
              "type": "section",
              "text": {
                  "type": "mrkdwn",
                  "text": `Hey Infra Team! 🔐\nNew keys are being requested to be added to ConfigMap. Please review the job details below and approve or reject this request.`,
                }
            },
            ...detailBlocks,
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "emoji": true,
                            "text": "Approve"
                        },
                        "style": "primary",
                        "value": "approve",
                        "action_id": "slack-approval-approve"
                    },
                    {
                        "type": "button",
                        "text": {
                                "type": "plain_text",
                                "emoji": true,
                                "text": "Reject"
                        },
                        "style": "danger",
                        "value": "reject",
                        "action_id": "slack-approval-reject"
                    }
                ]
            }
        ]
      });
    })();

    app.action('slack-approval-approve', async ({ack, client, body, logger}) => {
      await ack();
      try {
        const response_blocks = (<BlockAction>body).message?.blocks
        response_blocks.pop()
        response_blocks.push({
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': `Approved by <@${body.user.id}> `,
          },
        })

        await client.chat.update({
          channel: body.channel?.id || "",
          ts: (<BlockAction>body).message?.ts || "",
          blocks: response_blocks
        })
      } catch (error) {
        logger.error(error)
      }
      process.exit(0)
    });

    app.action('slack-approval-reject', async ({ack, client, body, logger}) => {
      await ack();
      try {
        const response_blocks = (<BlockAction>body).message?.blocks
        response_blocks.pop()
        response_blocks.push({
          'type': 'section',
          'text': {
            'type': 'mrkdwn',
            'text': `Rejected by <@${body.user.id}>`,
          },
        })

        await client.chat.update({
          channel: body.channel?.id || "",
          ts: (<BlockAction>body).message?.ts || "",
          blocks: response_blocks
        });
      } catch (error) {
        logger.error(error)
      }
      process.exit(1)
    });

    (async () => {
      await app.start(3000);
      console.log('Waiting Approval reaction.....');
    })();
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
