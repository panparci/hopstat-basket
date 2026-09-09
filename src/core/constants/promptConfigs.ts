import { SmartPromptFlow } from '../types/prompts';

export const PROMPT_FLOWS: Record<string, SmartPromptFlow> = {
  'missed_shot': {
    id: 'missed_shot',
    triggerEvent: 'custom',
    initialStepId: 'miss_factor',
    steps: {
      'miss_factor': {
        id: 'miss_factor',
        title: 'FAKTOR KEGAGALAN',
        description: 'Apakah ada faktor berikut pada tembakan ini?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'normal', label: 'TIDAK ADA (NORMAL)', nextStepId: 'rebound_selection', icon: 'Circle' },
          { id: 'blocked', label: 'DIBLOCK LAWAN', nextStepId: 'block_actor', icon: 'Ban' },
          { id: 'fouled', label: 'SHOOTING FOUL', nextStepId: 'fouler_actor', icon: 'Flag' }
        ]
      },
      'block_actor': {
        id: 'block_actor',
        title: 'SIAPA YANG BLOCK?',
        description: 'Pilih pemain lawan yang melakukan block',
        actorType: 'opponent',
        inputType: 'player_selection',
        playerFilter: 'on_court',
        isFinal: false,
        options: [
          { id: 'next', label: 'LANJUT KE REBOUND', nextStepId: 'rebound_selection' }
        ]
      },
      'fouler_actor': {
        id: 'fouler_actor',
        title: 'SIAPA YANG FOUL?',
        description: 'Pilih pemain lawan yang melakukan pelanggaran',
        actorType: 'opponent',
        inputType: 'player_selection',
        playerFilter: 'on_court',
        isFinal: false,
        options: [
          { id: 'next', label: 'LANJUT KE REBOUND', nextStepId: 'rebound_selection' }
        ]
      },
      'rebound_selection': {
        id: 'rebound_selection',
        title: 'REBOUND',
        description: 'Siapa yang mendapatkan bola?',
        actorType: 'either',
        inputType: 'player_selection',
        playerFilter: 'on_court',
        isFinal: true,
        options: [
          { id: 'ball_out', label: 'BOLA OUT / MATI', action: 'deadball_restart', icon: 'LogOut' }
        ]
      }
    }
  },
  'blocked_shot': {
    id: 'blocked_shot',
    triggerEvent: 'blocked_shot',
    initialStepId: 'block_outcome',
    steps: {
      'block_outcome': {
        id: 'block_outcome',
        title: 'BLOCK OUTCOME',
        description: 'Apa yang terjadi setelah block?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'rebound', label: 'REBOUND / STEAL', nextStepId: 'rebound_selection', icon: 'RotateCcw' },
          { id: 'out_of_bounds', label: 'OUT OF BOUNDS', action: 'deadball_restart', icon: 'LogOut' }
        ]
      },
      'rebound_selection': {
        id: 'rebound_selection',
        title: 'REBOUND / STEAL',
        description: 'Siapa yang menguasai bola?',
        actorType: 'either',
        inputType: 'player_selection',
        playerFilter: 'on_court',
        isFinal: true
      }
    }
  },
  'foul': {
    id: 'foul',
    triggerEvent: 'foul',
    initialStepId: 'foul_continuation',
    steps: {
      'foul_continuation': {
        id: 'foul_continuation',
        title: 'FOUL CONTINUATION',
        description: 'Apa kelanjutan dari foul ini?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'free_throws', label: 'FREE THROWS', nextStepId: 'ft_count', icon: 'Hash' },
          { id: 'inbound', label: 'INBOUND', action: 'deadball_restart', icon: 'ArrowRightCircle' },
          { id: 'and_one', label: 'AND ONE', action: 'and_one', icon: 'PlusCircle' }
        ]
      },
      'ft_count': {
        id: 'ft_count',
        title: 'FREE THROW COUNT',
        description: 'Berapa jumlah tembakan bebas?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: '1ft', label: '1 FREE THROW', action: 'start_ft_1', icon: 'ChevronRight' },
          { id: '2ft', label: '2 FREE THROWS', action: 'start_ft_2', icon: 'ChevronsRight' },
          { id: '3ft', label: '3 FREE THROWS', action: 'start_ft_3', icon: 'Zap' }
        ]
      }
    }
  },
  'lineup_check': {
    id: 'lineup_check',
    triggerEvent: 'custom',
    initialStepId: 'verify_lineup',
    steps: {
      'verify_lineup': {
        id: 'verify_lineup',
        title: 'VERIFIKASI LINEUP',
        description: 'Apakah pemain di lapangan sudah sesuai?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'correct', label: 'SUDAH SESUAI', action: 'confirm_lineup', icon: 'CheckCircle' },
          { id: 'adjust', label: 'PERLU PENYESUAIAN', nextStepId: 'correction_type', icon: 'Settings' }
        ]
      },
      'correction_type': {
        id: 'correction_type',
        title: 'PENYESUAIAN LINEUP',
        description: 'Apa yang ingin Anda lakukan?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'add_player', label: 'TAMBAH PEMAIN', nextStepId: 'add_player_selection', icon: 'PlusCircle' },
          { id: 'remove_player', label: 'KURANGI PEMAIN', nextStepId: 'remove_player_selection', icon: 'MinusCircle' }
        ]
      },
      'add_player_selection': {
        id: 'add_player_selection',
        title: 'TAMBAH PEMAIN',
        description: 'Pilih pemain yang seharusnya ada di lapangan',
        actorType: 'our_team',
        inputType: 'player_selection',
        playerFilter: 'all',
        isFinal: true
      },
      'remove_player_selection': {
        id: 'remove_player_selection',
        title: 'KURANGI PEMAIN',
        description: 'Pilih pemain yang seharusnya keluar dari lapangan',
        actorType: 'our_team',
        inputType: 'player_selection',
        playerFilter: 'on_court',
        isFinal: true
      }
    }
  },
  'manual_sub': {
    id: 'manual_sub',
    triggerEvent: 'custom',
    initialStepId: 'select_team',
    steps: {
      'select_team': {
        id: 'select_team',
        title: 'PILIH TIM',
        description: 'Tim mana yang melakukan pergantian?',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'home', label: 'TIM KAMI', nextStepId: 'input_time', icon: 'Home' },
          { id: 'away', label: 'TIM LAWAN', nextStepId: 'input_time', icon: 'Users' }
        ]
      },
      'input_time': {
        id: 'input_time',
        title: 'WAKTU PERGANTIAN',
        description: 'Masukkan waktu pertandingan (MMSS)',
        actorType: 'none',
        inputType: 'time_input',
        isFinal: false,
        options: [
          { id: 'next', label: 'LANJUT', nextStepId: 'sub_type' }
        ]
      },
      'sub_type': {
        id: 'sub_type',
        title: 'JENIS PERGANTIAN',
        description: 'Pilih aksi pergantian',
        actorType: 'none',
        inputType: 'option_selection',
        options: [
          { id: 'sub_in', label: 'PEMAIN MASUK', nextStepId: 'player_in_only_selection', icon: 'LogIn' },
          { id: 'sub_out', label: 'PEMAIN KELUAR', nextStepId: 'player_out_selection', icon: 'LogOut' },
          { id: 'swap', label: 'TUKAR PEMAIN', nextStepId: 'player_in_selection', icon: 'RefreshCw' }
        ]
      },
      'player_in_only_selection': {
        id: 'player_in_only_selection',
        title: 'PEMAIN MASUK',
        description: 'Pilih pemain yang masuk ke lapangan',
        actorType: 'none',
        inputType: 'player_selection',
        playerFilter: 'all',
        isFinal: true
      },
      'player_in_selection': {
        id: 'player_in_selection',
        title: 'PEMAIN MASUK',
        description: 'Pilih pemain yang masuk ke lapangan',
        actorType: 'none',
        inputType: 'player_selection',
        playerFilter: 'all',
        isFinal: false,
        options: [
          { id: 'next', label: 'LANJUT', nextStepId: 'player_out_selection' }
        ]
      },
      'player_out_selection': {
        id: 'player_out_selection',
        title: 'PEMAIN KELUAR',
        description: 'Pilih pemain yang keluar dari lapangan',
        actorType: 'none',
        inputType: 'player_selection',
        playerFilter: 'on_court',
        isFinal: true
      }
    }
  }
};
