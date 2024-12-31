import express from 'express';
import {
	Client,
	GatewayIntentBits,
	TextChannel,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder
} from 'discord.js';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import type { MessageActionRowComponentBuilder } from 'discord.js';

config({ path: '.env' });

const app = express();
app.use(express.json());

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || '';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

const reportData = new Map<string, { twyntId: string; userId: string }>();

interface twyntInfo {
	id: string;
	content: string;
	has_image: boolean;
}

interface UserInfo {
	id: string;
	handle: string;
	username: string;
}

function startBot() {
	client.on('ready', () => {
		console.log(`Logged in as ${client.user?.tag}!`);
	});

	client.on('messageCreate', async (message) => {
		if (!message.member?.roles.cache.get(process.env.DISCORD_ADMIN_ROLE!)) return;

		const args = message.content.split(' ');

		if (args[0] === '!verify' && args[1]) {
			try {
				const response = await fetch(`${API_BASE_URL}/api/verify?handle=${args[1]}`, {
					method: 'POST',
					headers: {
						Authorization: process.env.ADMIN_KEY!
					}
				});

				if (response.ok) {
					message.reply('Success');
				} else {
					message.reply(`Error: ${response.status} | ${response.statusText}`);
				}
			} catch (error) {
				console.error('Error verifying user:', error);
				message.reply('An error occurred while verifying the user.');
			}
		}
	});
	client.on('interactionCreate', async (interaction) => {
		try {
			if (!interaction.isButton()) return;

			const { message } = interaction;

			const messageId = message.id;
			const report = reportData.get(messageId);

			if (!report) {
				await interaction.reply({ content: 'Error: Report data not found', ephemeral: true });
				return;
			}

			// Defer the reply immediately
			await interaction.deferUpdate();

			await handleButtonPress(interaction, report.twyntId, report.userId);
		} catch (error) {
			console.error('Error handling interaction:', error);
		}
	});

	client.login(DISCORD_TOKEN);
}

async function sendReport(text: string, twyntId: string, userId: string, reporterId: string) {
	if (!client.isReady()) {
		throw new Error('Discord bot is not ready');
	}

	try {
		const channel = await client.channels.fetch(CHANNEL_ID);

		if (!(channel instanceof TextChannel)) {
			throw new Error('Invalid channel');
		}

		const reportedtwynt = await fetchtwyntInfo(twyntId);
		const reportedUser = await fetchUserInfo(userId);
		const reporter = await fetchUserInfo(reporterId);

		const a = await createReportEmbed(text, reportedtwynt, reportedUser, reporter);

		const row = createActionRow();

		const sentMessage = await channel.send({
			embeds: [a.embed],
			files: a.files,
			components: [row]
		});

		reportData.set(sentMessage.id, { twyntId, userId });

		return { success: true, message: 'Report sent to Discord' };
	} catch (error) {
		console.error('Error sending report:', error);
		return { success: false, message: 'Failed to send report' };
	}
}

async function createReportEmbed(
	text: string,
	reportedtwynt: twyntInfo,
	reportedUser: UserInfo,
	reporter: UserInfo
) {
	const userAvatarUrl = `http://${process.env.MINIO_ENDPOINT}:9000/${process.env.S3_BUCKET_NAME}/${reportedUser.id}_small.webp`;

	const embed = new EmbedBuilder()
		.setColor('#FF0000')
		.setTitle('New Report')
		.setDescription(text)
		.setAuthor({ name: reportedUser.handle, iconURL: `attachment://${reportedUser.id}_small.webp` })
		.addFields(
			{
				name: 'Reported User',
				value: `${reportedUser.username} (@${reportedUser.handle})`,
				inline: true
			},
			{ name: 'Reporter', value: `${reporter.username} (@${reporter.handle})`, inline: true },
			{ name: 'twynt Content', value: reportedtwynt.content || 'N/A' },
			{ name: 'twynt ID', value: reportedtwynt.id },
			{ name: 'User ID', value: reportedUser.id },
			{ name: 'Reporter ID', value: reporter.id }
		)
		.setTimestamp();

	const files = [];

	try {
		const avatarResponse = await fetch(userAvatarUrl);
		if (avatarResponse.ok) {
			const avatarBuffer = await avatarResponse.buffer();
			files.push({ attachment: avatarBuffer, name: `${reportedUser.id}_small.webp` });
		}
	} catch (error) {
		console.error('Error fetching user avatar:', error);
	}

	if (reportedtwynt.has_image) {
		const twyntImageUrl = `http://${process.env.MINIO_ENDPOINT}:9000/${process.env.S3_BUCKET_NAME}/${reportedtwynt.id}.webp`;
		embed.setThumbnail(`attachment://${reportedtwynt.id}.webp`);

		try {
			const twyntImageResponse = await fetch(twyntImageUrl);
			if (twyntImageResponse.ok) {
				const twyntImageBuffer = await twyntImageResponse.buffer();
				files.push({ attachment: twyntImageBuffer, name: `${reportedtwynt.id}.webp` });
			}
		} catch (error) {
			console.error('Error fetching twynt image:', error);
		}
	}

	return { embed, files };
}

function createActionRow() {
	return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('deletetwynt')
			.setLabel('Delete twynt')
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder().setCustomId('banUser').setLabel('Ban User').setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId('ignore')
			.setLabel('Ignore Report')
			.setStyle(ButtonStyle.Secondary)
	);
}

async function fetchtwyntInfo(twyntId: string): Promise<twyntInfo> {
	try {
		const response = await fetch(`${API_BASE_URL}/api/twynt?id=${twyntId}`, {
			headers: { Authorization: ADMIN_KEY }
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch twynt info: ${response.statusText}`);
		}
		return response.json();
	} catch (error) {
		console.error('Error fetching twynt info:', error);
		return { id: twyntId, content: 'Error fetching twynt info', has_image: false };
	}
}

async function fetchUserInfo(userId: string): Promise<UserInfo> {
	try {
		const response = await fetch(`${API_BASE_URL}/api/profile?id=${userId}`);
		if (!response.ok) {
			throw new Error(`Failed to fetch user info: ${response.statusText}`);
		}
		return response.json();
	} catch (error) {
		console.error('Error fetching user info:', error);
		return { id: userId, handle: 'Unknown', username: 'Unknown' };
	}
}

app.post('/report', async (req: express.Request, res: express.Response) => {
	try {
		const { text, userId, twyntId, reporterId } = req.body;

		if (!text || !userId || !twyntId || !reporterId) {
			return res.status(400).json({ error: 'Missing required fields' });
		}

		const result = await sendReport(text, twyntId, userId, reporterId);
		res.json(result);
	} catch (error) {
		console.error('Error processing report:', error);
		res.status(500).json({ error: 'Failed to process report' });
	}
});

startBot();
app.listen(5444, () => {
	console.log('Server is running on port 5444');
});

async function handleButtonPress(interaction: any, twyntId: string, userId: string) {
	try {
		let resultMessage = '';

		if (interaction.customId === 'deletetwynt') {
			const response = await fetch(`${API_BASE_URL}/api/twynt?id=${twyntId}`, {
				method: 'DELETE',
				headers: { Authorization: ADMIN_KEY }
			});

			if (response.ok) {
				resultMessage = 'twynt deleted successfully';
			} else {
				throw new Error(`Failed to delete twynt: ${response.status} | ${response.statusText}`);
			}
		} else if (interaction.customId === 'banUser') {
			const response = await fetch(`${API_BASE_URL}/api/ban`, {
				method: 'POST',
				headers: {
					Authorization: ADMIN_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ userId })
			});

			if (response.ok) {
				resultMessage = 'User banned successfully';
			} else {
				throw new Error(`Failed to ban user: ${response.status} | ${response.statusText}`);
			}
		} else if (interaction.customId === 'ignore') {
			resultMessage = 'Report ignored';
		} else {
			resultMessage = 'Unknown action';
		}

		await interaction.editReply({
			content: resultMessage,
			embeds: interaction.message.embeds,
			components: []
		});
	} catch (error) {
		console.error('Error handling button press:', error);

		await interaction.editReply({
			content: 'An error occurred while processing your request',
			embeds: interaction.message.embeds,
			components: []
		});
	}
}
