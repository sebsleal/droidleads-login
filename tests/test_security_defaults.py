from __future__ import annotations

import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class SecurityDefaultsTests(unittest.TestCase):
    def test_rls_policies_are_read_only_for_browser_roles(self) -> None:
        sql = (PROJECT_ROOT / "db" / "migrations" / "0005_rls_policies.sql").read_text(
            encoding="utf-8"
        )

        self.assertIn("create policy leads_dashboard_read_only on public.leads", sql)
        self.assertIn("create policy cases_dashboard_read_only on public.cases", sql)
        self.assertIn(
            "create policy storm_tracking_dashboard_read_only on public.storm_tracking",
            sql,
        )
        self.assertNotIn("for insert\n    to anon, authenticated", sql)
        self.assertNotIn("for update\n    to anon, authenticated", sql)

    def test_browser_writes_are_flag_gated_and_default_off(self) -> None:
        env_example = (PROJECT_ROOT / ".env.example").read_text(encoding="utf-8")
        supabase_ts = (PROJECT_ROOT / "src" / "lib" / "supabase.ts").read_text(
            encoding="utf-8"
        )
        use_tracking_ts = (PROJECT_ROOT / "src" / "lib" / "useTracking.ts").read_text(
            encoding="utf-8"
        )
        use_cases_ts = (PROJECT_ROOT / "src" / "lib" / "useCases.ts").read_text(
            encoding="utf-8"
        )
        use_storm_tracking_ts = (
            PROJECT_ROOT / "src" / "lib" / "useStormTracking.ts"
        ).read_text(encoding="utf-8")

        self.assertIn("VITE_ENABLE_BROWSER_WRITES=false", env_example)
        self.assertIn(
            'const browserWriteFlag = import.meta.env.VITE_ENABLE_BROWSER_WRITES === "true";',
            supabase_ts,
        )
        self.assertIn(
            "export const browserCanWrite = Boolean(supabase && browserWriteFlag);",
            supabase_ts,
        )
        self.assertIn("if (!browserCanWrite || !supabase)", use_tracking_ts)
        self.assertIn("if (!browserCanWrite || !supabase) return false;", use_cases_ts)
        self.assertIn(
            "if (!browserCanWrite || !supabase) return false;",
            use_storm_tracking_ts,
        )


if __name__ == "__main__":
    unittest.main()
