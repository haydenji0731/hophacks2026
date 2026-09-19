"""Discord bot: paste a suspicious message, get the same scam analysis as the phone pipeline."""

from __future__ import annotations

import logging

import discord
from discord import app_commands
from discord.ext import commands

from config import settings
from detector import DetectorError, analyze_text
from format_reply import format_reply

log = logging.getLogger("discord_bot")

INTENTS = discord.Intents.default()
INTENTS.message_content = True
INTENTS.messages = True


def _excerpt(text: str, limit: int = 1800) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1] + "…"


def embed_from_payload(payload: dict) -> discord.Embed:
    data = format_reply(payload, site_url=settings.site_url)
    embed = discord.Embed(
        title=data["title"],
        description=data["description"][:4000],
        color=data["color"],
    )
    for field in data["fields"]:
        embed.add_field(name=field["name"], value=field["value"], inline=field.get("inline", False))
    return embed


class ScamBot(commands.Bot):
    def __init__(self) -> None:
        super().__init__(command_prefix=commands.when_mentioned_or("!"), intents=INTENTS)

    async def setup_hook(self) -> None:
        await self.tree.sync()


bot = ScamBot()


async def check_and_reply(destination: discord.abc.Messageable, text: str) -> None:
    excerpt = _excerpt(text)
    if len(excerpt) < 12:
        await destination.send("Paste a bit more of the message so we can check it.")
        return
    try:
        payload = await analyze_text(excerpt)
    except DetectorError as exc:
        await destination.send(
            f"Couldn't reach the scam detector ({exc.message}). "
            "Is `backend/detector` running on port 8000?"
        )
        return
    await destination.send(embed=embed_from_payload(payload))


@bot.tree.command(name="scamcheck", description="Check whether a message looks like a scam.")
@app_commands.describe(message="Paste the suspicious text (no passwords or account numbers).")
async def scamcheck(interaction: discord.Interaction, message: str) -> None:
    await interaction.response.defer(thinking=True)
    excerpt = _excerpt(message)
    if len(excerpt) < 12:
        await interaction.followup.send("Paste a bit more of the message so we can check it.")
        return
    try:
        payload = await analyze_text(excerpt)
    except DetectorError as exc:
        await interaction.followup.send(
            f"Couldn't reach the scam detector ({exc.message}). "
            "Is `backend/detector` running on port 8000?"
        )
        return
    await interaction.followup.send(embed=embed_from_payload(payload))


@bot.command(name="scam")
async def scam_prefix(ctx: commands.Context, *, text: str | None = None) -> None:
    """Check a pasted message, or reply to one with !scam."""
    body = text or ""
    if ctx.message.reference and ctx.message.reference.resolved:
        ref = ctx.message.reference.resolved
        if isinstance(ref, discord.Message) and ref.content:
            body = body or ref.content
    if not body.strip():
        await ctx.reply("Reply to a message with `!scam`, or write `!scam` plus the text.")
        return
    async with ctx.typing():
        await check_and_reply(ctx, body)


@bot.event
async def on_ready() -> None:
    log.info("Logged in as %s — /scamcheck and !scam are live", bot.user)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not settings.discord_bot_token:
        raise SystemExit("Set DISCORD_BOT_TOKEN in backend/discord_bot/.env or the repo-root .env")
    bot.run(settings.discord_bot_token)


if __name__ == "__main__":
    main()
