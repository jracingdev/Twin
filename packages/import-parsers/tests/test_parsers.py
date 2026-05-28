import io
import json
import unittest
import zipfile
from pathlib import Path

from twin_parsers import parse_export
from twin_parsers.dispatcher import parse_zip
from twin_parsers.instagram import parse_instagram
from twin_parsers.facebook import parse_facebook
from twin_parsers.messenger import parse_messenger
from twin_parsers.telegram import parse_telegram
from twin_parsers.whatsapp import parse_whatsapp

FIXTURES = Path(__file__).parent / "fixtures"


class ParserTests(unittest.TestCase):
    def test_whatsapp_br_format(self):
        text = (FIXTURES / "whatsapp_chat.txt").read_text(encoding="utf-8")
        msgs = parse_whatsapp(text, owner_name="Eu")
        self.assertGreaterEqual(len(msgs), 2)
        self.assertEqual(msgs[0].channel, "whatsapp")
        self.assertEqual(msgs[0].role, "user")

    def test_telegram_export(self):
        text = (FIXTURES / "telegram_result.json").read_text(encoding="utf-8")
        msgs = parse_telegram(text)
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0].channel, "telegram")
        self.assertEqual(msgs[0].role, "user")

    def test_instagram_meta_json(self):
        text = (FIXTURES / "instagram_thread.json").read_text(encoding="utf-8")
        msgs = parse_instagram(text, owner_name="Eu")
        self.assertEqual(len(msgs), 2)
        self.assertEqual(msgs[0].channel, "instagram")
        self.assertIn("Instagram", msgs[0].body)

    def test_facebook_meta_json(self):
        text = (FIXTURES / "facebook_thread.json").read_text(encoding="utf-8")
        msgs = parse_facebook(text, owner_name="João Silva")
        self.assertEqual(len(msgs), 1)
        self.assertEqual(msgs[0].channel, "facebook")

    def test_messenger_channel(self):
        text = (FIXTURES / "facebook_thread.json").read_text(encoding="utf-8")
        msgs = parse_messenger(text, file_hint="messages/inbox/thread")
        self.assertEqual(msgs[0].channel, "messenger")

    def test_parse_export_dispatcher(self):
        text = (FIXTURES / "instagram_thread.json").read_text(encoding="utf-8")
        msgs = parse_export("instagram", text)
        self.assertTrue(all(m.channel == "instagram" for m in msgs))

    def test_zip_with_json_inside(self):
        buf = io.BytesIO()
        json_bytes = (FIXTURES / "instagram_thread.json").read_bytes()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr(
                "your_instagram_activity/messages/inbox/chat/message_1.json",
                json_bytes,
            )
        msgs = parse_zip(buf.getvalue(), default_channel="instagram")
        self.assertGreaterEqual(len(msgs), 2)
        self.assertEqual(msgs[0].channel, "instagram")


if __name__ == "__main__":
    unittest.main()
