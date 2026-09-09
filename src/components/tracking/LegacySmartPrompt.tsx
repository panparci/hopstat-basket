import React, { useState } from "react";
import {
  Match,
  MatchRoster,
  Player,
  GameEvent,
  Possession,
} from "../../core/types/stats";
import { SmartPromptModal } from "../organisms/SmartPromptModal";

interface LegacySmartPromptProps {
  data: any;
  match: Match;
  matchRosters: MatchRoster[];
  events: GameEvent[];
  activePossession: Partial<Possession> | null;
  allPlayers: Player[];
  handleSmartPromptSelect: (selectedPlayerId: string) => void;
  setInteraction: (type: any | null, data?: any) => void;
}

export const LegacySmartPrompt: React.FC<LegacySmartPromptProps> = ({
  data,
  match,
  matchRosters,
  events,
  activePossession,
  allPlayers,
  handleSmartPromptSelect,
  setInteraction,
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(() => {
    if (data?.type === "foul_drawn") {
      const foulerTeam = data.team;
      if (match.recordingType !== "full" && foulerTeam === "away") {
        return "opp";
      }
    }
    return null;
  });

  const getPlayerName = (playerId?: string) => {
    if (!playerId) return "Unknown";
    if (playerId === "opp" || playerId === "away_team") return "Lawan";
    if (!allPlayers) return "Unknown";
    return allPlayers.find((p) => p.id === playerId)?.name || "Unknown";
  };

  const { type: promptType, team } = data;
  const homeTeamId = match.teamId || "home_team";
  const awayTeamId = match.opponentTeamId || "away_team";

  const homeRoster = matchRosters
    .filter((r) => r.teamId === homeTeamId && r.isActive)
    .map(
      (r) =>
        ({
          id: r.profileId,
          name: r.name,
          jersey: r.jerseyNumber,
          isActive: r.isActive,
        }) as Player,
    );
  const awayRoster = matchRosters
    .filter((r) => r.teamId === awayTeamId && r.isActive)
    .map(
      (r) =>
        ({
          id: r.profileId,
          name: r.name,
          jersey: r.jerseyNumber,
          isActive: r.isActive,
        }) as Player,
    );

  const opponentTeamPlayer: Player = {
    id: "opp",
    name: "Opponent Team",
    displayName: "Opponent Team",
    jersey: "OPP",
    isActive: true,
    isPlaceholder: true,
  };

  let title = "";
  let description = "";
  let groups: any[] = [];
  let skipText = "Lewati";

  if (promptType === "rebound") {
    title = "Siapa yang mendapat Rebound?";
    skipText = "Lewati (Bola Keluar / Team Rebound)";
    if (match.recordingType === "full") {
      groups = [
        {
          title: "Tim Home",
          players: homeRoster,
          team: "home",
          color: match.ourColor,
          theme: match.ourTheme,
        },
        {
          title: "Tim Away",
          players: awayRoster,
          team: "away",
          color: match.theirColor,
          theme: match.theirTheme,
        },
      ];
    } else {
      groups = [
        {
          title: "Tim Kami",
          players: homeRoster,
          team: "home",
          color: match.ourColor,
          theme: match.ourTheme,
        },
        {
          title: "Lawan",
          players: [
            {
              ...opponentTeamPlayer,
              displayName: "Rebound by Opponent",
              name: "Rebound by Opponent",
              jersey: "REB",
            },
          ],
          team: "away",
          layout: "large-buttons",
          color: match.theirColor,
          theme: match.theirTheme,
        },
      ];
    }
  } else if (promptType === "steal") {
    title = "Apakah bola di-Steal?";
    description = "Pilih pemain yang melakukan steal";
    skipText = "Tidak (Unforced Error / Out of Bounds)";
    const oppTeam = team === "home" ? "away" : "home";
    const oppRoster = oppTeam === "home" ? homeRoster : awayRoster;
    if (match.recordingType === "full") {
      groups = [
        {
          title: oppTeam === "home" ? "Tim Home" : "Tim Away",
          players: oppRoster,
          team: oppTeam,
        },
      ];
    } else {
      if (oppTeam === "home")
        groups = [{ title: "Tim Kami", players: homeRoster, team: "home" }];
      else
        groups = [
          {
            title: "Lawan",
            players: [
              {
                ...opponentTeamPlayer,
                displayName: "Yes, Steal by Opponent",
                name: "Steal by Opponent",
                jersey: "STL",
              },
            ],
            team: "away",
            layout: "large-buttons",
          },
        ];
    }
  } else if (promptType === "turnover") {
    title = "Siapa yang kehilangan bola (Turnover)?";
    description = "Pilih pemain yang melakukan turnover";
    const oppTeam = team === "home" ? "away" : "home";
    const oppRoster = oppTeam === "home" ? homeRoster : awayRoster;
    if (match.recordingType === "full") {
      groups = [
        {
          title: oppTeam === "home" ? "Tim Home" : "Tim Away",
          players: oppRoster,
          team: oppTeam,
        },
      ];
    } else {
      if (oppTeam === "home")
        groups = [{ title: "Tim Kami", players: homeRoster, team: "home" }];
      else
        groups = [
          {
            title: "Lawan",
            players: [
              {
                ...opponentTeamPlayer,
                displayName: "Turnover by Opponent",
                name: "Turnover by Opponent",
                jersey: "TO",
              },
            ],
            team: "away",
            layout: "large-buttons",
          },
        ];
    }
  } else if (promptType === "block") {
    title = "Siapa yang melakukan Block?";
    description = "Pilih pemain yang melakukan block";
    const oppTeam = team === "home" ? "away" : "home";
    const oppRoster = oppTeam === "home" ? homeRoster : awayRoster;
    if (match.recordingType === "full") {
      groups = [
        {
          title: oppTeam === "home" ? "Tim Home" : "Tim Away",
          players: oppRoster,
          team: oppTeam,
        },
      ];
    } else {
      if (oppTeam === "home")
        groups = [{ title: "Tim Kami", players: homeRoster, team: "home" }];
      else
        groups = [
          {
            title: "Lawan",
            players: [
              {
                ...opponentTeamPlayer,
                displayName: "Block by Opponent",
                name: "Block by Opponent",
                jersey: "BLK",
              },
            ],
            team: "away",
            layout: "large-buttons",
          },
        ];
    }
  } else if (promptType === "fouler") {
    title = "Siapa yang melakukan Foul?";
    description = "Pilih pemain yang melakukan pelanggaran";
    const foulerTeam = team;
    const foulerRoster = foulerTeam === "home" ? homeRoster : awayRoster;
    if (match.recordingType === "full") {
      groups = [
        {
          title: foulerTeam === "home" ? "Tim Home" : "Tim Away",
          players: foulerRoster,
          team: foulerTeam,
        },
      ];
    } else {
      if (foulerTeam === "home")
        groups = [{ title: "Tim Kami", players: homeRoster, team: "home" }];
      else
        groups = [
          {
            title: "Lawan",
            players: [opponentTeamPlayer],
            team: "away",
            layout: "large-buttons",
          },
        ];
    }
  } else if (promptType === "foul_drawn") {
    const foulerTeam = data.team;
    const victimTeam = foulerTeam === "home" ? "away" : "home";
    const victimId = data.playerId;
    const victimName = getPlayerName(victimId);

    title = `Siapa yang melanggar ${victimName}?`;
    description = "Pilih pemain yang melanggar & jenis pelanggaran";

    const foulerRoster = foulerTeam === "home" ? homeRoster : awayRoster;
    const isDefensiveFoul = foulerTeam !== activePossession?.teamInPossession;

    if (match.recordingType === "full") {
      groups = [
        {
          title: foulerTeam === "home" ? "Tim Home" : "Tim Away",
          players: foulerRoster.map((p) => ({
            ...p,
            isSelected: selectedPlayer === p.id,
          })),
          team: foulerTeam,
        },
      ];
    } else {
      if (foulerTeam === "home") {
        groups = [
          {
            title: "Tim Kami",
            players: homeRoster.map((p) => ({
              ...p,
              isSelected: selectedPlayer === p.id,
            })),
            team: "home",
          },
        ];
      } else {
        groups = [
          {
            title: "Lawan",
            players: [
              {
                ...opponentTeamPlayer,
                isSelected: selectedPlayer === opponentTeamPlayer.id,
              },
            ],
            team: "away",
            layout: "large-buttons",
          },
        ];
      }
    }

    let foulTypes = [
      {
        id: "foul_personal",
        name: "Personal Foul",
        jersey: "PF",
        isActive: true,
      },
      {
        id: "foul_shooting",
        name: "Shooting Foul",
        jersey: "🎯",
        isActive: true,
      },
      { id: "foul_reach_in", name: "Reach-In", jersey: "RI", isActive: true },
      { id: "foul_blocking", name: "Blocking", jersey: "BLK", isActive: true },
      { id: "foul_holding", name: "Holding", jersey: "H", isActive: true },
      {
        id: "foul_loose_ball",
        name: "Loose Ball",
        jersey: "LB",
        isActive: true,
      },
      { id: "foul_technical", name: "Technical", jersey: "T", isActive: true },
      {
        id: "foul_unsportsmanlike",
        name: "Unsportsmanlike",
        jersey: "U",
        isActive: true,
      },
      {
        id: "foul_double_team",
        name: "Double Team",
        jersey: "DT",
        isActive: true,
      },
      { id: "foul_offensive", name: "Offensive", jersey: "O", isActive: true },
    ];
    if (isDefensiveFoul)
      foulTypes = foulTypes.filter((f) => f.id !== "foul_offensive");
    groups.push({
      title: isDefensiveFoul ? "Jenis Defensive Foul" : "Jenis Foul",
      players: foulTypes.map((f) => ({
        ...f,
        isSelected: selectedAction === f.id,
      })) as any,
      layout: "grid",
    });
  } else if (promptType === "miss_outcome") {
    title = "Hasil Missed Shot";
    description = "Apa yang terjadi setelah tembakan meleset?";
    const oppTeam = team === "home" ? "away" : "home";
    const oppRoster = oppTeam === "home" ? homeRoster : awayRoster;
    const ourRoster = team === "home" ? homeRoster : awayRoster;
    const blockOptions = oppRoster.map((p) => ({
      ...p,
      id: `blk_${p.id}`,
      displayName: `Block by ${p.name}`,
    }));
    if (match.recordingType !== "full" && oppTeam === "away")
      blockOptions.push({
        ...opponentTeamPlayer,
        id: "blk_opp",
        displayName: "Block by Opponent",
      } as any);
    const reboundOptions = [...ourRoster, ...oppRoster];
    if (match.recordingType !== "full") {
      if (team === "home") reboundOptions.push(opponentTeamPlayer);
      else reboundOptions.push(...homeRoster);
    }
    groups = [
      { title: "Block (Jika Ada)", players: blockOptions, team: oppTeam },
      {
        title: "Foul Saat Shoot?",
        players: [
          {
            id: "foul_during_shot",
            name: "Foul (Shooting)",
            jersey: "🛑",
            isActive: true,
          },
        ] as any,
        layout: "large-buttons",
      },
      { title: "Rebound", players: reboundOptions, team: "neutral" },
      {
        title: "Lainnya",
        players: [{ id: "ball_out", name: "Bola Keluar", jersey: "🏀" }] as any,
        layout: "large-buttons",
      },
    ];
  } else if (promptType === "next_freethrow") {
    title = "Hasil Tembakan Free Throw (Lanjutan)";
    description = "Apakah free throw selanjutnya masuk atau meleset?";
    const options = [
      { id: "1pt_make", name: "Masuk (Make)", jersey: "✅" } as Player,
      { id: "1pt_miss", name: "Meleset (Miss)", jersey: "❌" } as Player,
    ];
    groups = [
      {
        title: "Hasil Tembakan",
        team: "neutral",
        layout: "large-buttons",
        players: options,
      },
    ];
  } else if (promptType === "freethrow") {
    const isMake = data.isMake;
    title = "Status Free Throw";
    description = isMake
      ? "Apakah masih ada sisa Free Throw?"
      : "FT Meleset. Apakah ada lagi atau bola hidup?";
    const options = [
      { id: "more", name: "Ada Lagi", jersey: "🔄" } as Player,
      {
        id: "last",
        name: isMake ? "FT Terakhir" : "FT Terakhir (Live Ball)",
        jersey: "🛑",
      } as Player,
    ];
    if (!isMake)
      options.push(
        { id: "ball_out", name: "Bola Keluar", jersey: "🏀" } as Player,
        { id: "airball", name: "Tidak Kena Ring", jersey: "⭕" } as Player,
      );
    groups = [
      {
        title: "Pilih Status",
        team: "neutral",
        layout: "large-buttons",
        players: options,
      },
    ];
  } else if (promptType === "jumpball") {
    title = data.isHeldBall
      ? "Held Ball / Situasi Berebut Bola"
      : "Jumpball / Start Possession";
    description =
      data.description ||
      "Siapa yang memenangkan jumpball atau mendapatkan possession awal?";
    skipText = "";

    const teamOptions = [
      { id: "home", name: match.ourTeamName || "Home", jersey: "🏠" } as Player,
      {
        id: "away",
        name: match.theirTeamName || "Away",
        jersey: "✈️",
      } as Player,
    ];

    groups = [
      {
        title: "Pilih Tim Pemenang",
        team: "neutral",
        layout: "large-buttons",
        players: teamOptions,
      },
    ];

    if (data.isHeldBall) {
      const tiedPlayerId = data.tiedPlayerId;
      groups.push({
        title: "Pemain Kami yang Terlibat (Untuk Log Turnover jika kalah)",
        players: homeRoster.map((p) => ({
          ...p,
          isActive: p.id === tiedPlayerId,
        })),
        team: "home",
      });
    }
  } else if (promptType === "assist") {
    title = "Siapa yang memberikan Assist?";
    skipText = "Tidak Ada (Unassisted)";
    groups = [
      {
        title: team === "home" ? "Tim Home" : "Tim Away",
        players: team === "home" ? homeRoster : awayRoster,
        team: team,
      },
    ];
    groups.push({
      title: "And-1 (Foul Saat Masuk)?",
      players: [
        {
          id: "foul_and_one",
          name: "Foul (And-1)",
          jersey: "➕",
          isActive: true,
        },
      ] as any,
      layout: "large-buttons",
    });
  } else if (promptType === "missing_event") {
    const isOpponentMissingEvent = team === "home";
    const shouldSimplify =
      match.recordingType === "team" && isOpponentMissingEvent;

    const homeLabel =
      match.ourHomeAway === "away"
        ? match.theirTeamName || "Lawan"
        : match.ourTeamName || "Kita";
    const awayLabel =
      match.ourHomeAway === "away"
        ? match.ourTeamName || "Kita"
        : match.theirTeamName || "Lawan";
    const missedPossessionTeamName = team === "home" ? awayLabel : homeLabel;

    title = "Possession Terlewat Terdeteksi";
    description = `Possession tim ${missedPossessionTeamName} belum diselesaikan. Hubungkan kejadian yang terlewat:`;
    skipText = "Abaikan (Lanjut Log Event)";
    let options = shouldSimplify
      ? [
          {
            id: "2pt_miss",
            name: "Missed Shot",
            jersey: "❌",
            isActive: true,
            isSelected: selectedAction === "2pt_miss",
          },
          {
            id: "to",
            name: "Turnover",
            jersey: "⚠️",
            isActive: true,
            isSelected: selectedAction === "to",
          },
          {
            id: "foul",
            name: "Foul",
            jersey: "🛑",
            isActive: true,
            isSelected: selectedAction === "foul",
          },
          {
            id: "ball_out",
            name: "Dead Ball",
            jersey: "🏀",
            isActive: true,
            isSelected: selectedAction === "ball_out",
          },
        ]
      : [
          {
            id: "2pt_miss",
            name: "2PT Miss",
            jersey: "2️⃣",
            isActive: true,
            isSelected: selectedAction === "2pt_miss",
          },
          {
            id: "3pt_miss",
            name: "3PT Miss",
            jersey: "3️⃣",
            isActive: true,
            isSelected: selectedAction === "3pt_miss",
          },
          {
            id: "to",
            name: "Turnover",
            jersey: "⚠️",
            isActive: true,
            isSelected: selectedAction === "to",
          },
          {
            id: "foul",
            name: "Foul",
            jersey: "🛑",
            isActive: true,
            isSelected: selectedAction === "foul",
          },
          {
            id: "ball_out",
            name: "Dead Ball",
            jersey: "🏀",
            isActive: true,
            isSelected: selectedAction === "ball_out",
          },
        ];
    groups = [
      {
        title: `1. Pilih Aktivitas Kejadian Terlewat`,
        players: options as any,
        layout: "grid-compact" as any,
      },
    ];

    const missedTeam = isOpponentMissingEvent ? "away" : "home";
    const missedTeamRoster = missedTeam === "home" ? homeRoster : awayRoster;
    const missedTeamColor =
      missedTeam === "home" ? match.ourColor : match.theirColor;
    const missedTeamTheme =
      missedTeam === "home" ? match.ourTheme : match.theirTheme;

    if (
      selectedAction &&
      selectedAction !== "ball_out" &&
      missedTeamRoster.length > 0
    ) {
      const teamOption = {
        id: "team",
        name: `Tim ${missedPossessionTeamName} (Kolektif)`,
        displayName: "Log sebagai Tim",
        jersey: "👥",
        isActive: true,
        isSelected: selectedPlayer === "team",
      };

      const rosterWithSelection = missedTeamRoster.map((p) => ({
        ...p,
        isSelected: selectedPlayer === p.id,
      }));

      groups.push({
        title: `2. Pilih Aktor / Pemain yang Terlibat`,
        players: [teamOption, ...rosterWithSelection],
        team: missedTeam,
        color: missedTeamColor,
        theme: missedTeamTheme,
        layout: "grid",
      });
    }
  }

  const homeLabel =
    match.ourHomeAway === "away"
      ? match.theirTeamName || "Lawan"
      : match.ourTeamName || "Kita";
  const awayLabel =
    match.ourHomeAway === "away"
      ? match.ourTeamName || "Kita"
      : match.theirTeamName || "Lawan";
  const missedPossessionTeamNameVar =
    promptType === "missing_event"
      ? team === "home"
        ? awayLabel
        : homeLabel
      : undefined;

  const handleSelect = (choiceId: string) => {
    if (promptType === "missing_event") {
      const isAction = [
        "2pt_miss",
        "3pt_miss",
        "to",
        "foul",
        "ball_out",
      ].includes(choiceId);
      if (isAction) {
        setSelectedAction(choiceId);
        if (choiceId === "ball_out") {
          setSelectedPlayer("team");
        } else if (!selectedPlayer) {
          setSelectedPlayer("team");
        }
      } else {
        setSelectedPlayer(choiceId);
      }
    } else if (promptType === "foul_drawn") {
      if (choiceId.startsWith("foul_")) {
        setSelectedAction(choiceId);
      } else {
        setSelectedPlayer(choiceId);
      }
    } else {
      handleSmartPromptSelect(choiceId);
    }
  };

  const handleConfirm = () => {
    if (promptType === "missing_event") {
      if (selectedAction) {
        if (selectedAction === "ball_out") {
          handleSmartPromptSelect("ball_out");
        } else {
          const actor = selectedPlayer || "team";
          handleSmartPromptSelect(`${selectedAction}_${actor}`);
        }
      }
    } else if (promptType === "foul_drawn") {
      if (selectedPlayer && selectedAction) {
        handleSmartPromptSelect(`${selectedPlayer}__${selectedAction}`);
      }
    }
  };

  const handleSkip = () => {
    if (promptType === "missing_event") {
      handleSmartPromptSelect("skip");
    } else {
      setInteraction(null);
    }
  };

  return (
    <SmartPromptModal
      isOpen={true}
      title={title}
      description={description}
      groups={groups}
      onSelectPlayer={handleSelect}
      onSkip={skipText ? handleSkip : undefined}
      skipText={skipText}
      type={promptType}
      recentEvents={events.slice(-5)}
      youtubeTimestamp={data.youtubeTimestamp}
      isPanel
      match={match}
      matchRosters={matchRosters}
      missedPossessionTeamName={missedPossessionTeamNameVar}
      onConfirm={
        promptType === "missing_event" || promptType === "foul_drawn"
          ? handleConfirm
          : undefined
      }
      confirmLabel={
        promptType === "missing_event"
          ? "Simpan Kejadian Terlewat"
          : promptType === "foul_drawn"
          ? "Simpan Pelanggaran"
          : undefined
      }
      isConfirmDisabled={
        promptType === "missing_event"
          ? !selectedAction
          : promptType === "foul_drawn"
          ? !selectedPlayer || !selectedAction
          : undefined
      }
    />
  );
};
