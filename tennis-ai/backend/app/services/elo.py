"""Elo rating calculation for confirmed match sets.

K=32 (standard for amateur play).
R0=1500 default initial rating (set in User model).
Expected score E_A = 1 / (1 + 10^((R_B - R_A) / 400)).
New rating: R_A' = R_A + K * (S_A - E_A), where S_A is 1 for win, 0 for loss.
"""
from __future__ import annotations

K_FACTOR = 32


def expected_score(rating_a: int, rating_b: int) -> float:
    return 1.0 / (1.0 + 10 ** ((rating_b - rating_a) / 400))


def compute_deltas(
    rating_a: int, rating_b: int, a_won: bool, k: int = K_FACTOR
) -> tuple[int, int]:
    """Return (delta_a, delta_b) integer Elo changes after the match.

    Sum of returned deltas is zero (within rounding by ±1).
    """
    e_a = expected_score(rating_a, rating_b)
    s_a = 1.0 if a_won else 0.0
    delta_a = round(k * (s_a - e_a))
    delta_b = -delta_a
    return delta_a, delta_b
