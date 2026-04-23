export type RoomPhase = "lobby" | "writing" | "playing" | "finished";
export type RoundPhase = "faking" | "voting" | "reveal";
export type VoteTargetKind = "fake" | "truth";

export interface Room {
  id: string;
  host_id: string;
  phase: RoomPhase;
  current_round: number;
  created_at: string;
}

export interface Player {
  id: string;
  room_id: string;
  nickname: string;
  score: number;
  joined_at: string;
  is_host: boolean;
  is_spectator: boolean;
}

export interface Sentence {
  id: string;
  room_id: string;
  player_id: string;
  first_half: string;
  second_half: string | null;
  submitted: boolean;
}

export interface Round {
  id: string;
  room_id: string;
  round_number: number;
  sentence_id: string;
  phase: RoundPhase;
  started_at: string;
}

export interface Fake {
  id: string;
  round_id: string;
  player_id: string;
  text: string;
}

export interface Vote {
  id: string;
  round_id: string;
  voter_id: string;
  target_kind: VoteTargetKind;
  target_id: string | null;
}

type Insertable<T, OptionalKeys extends keyof T = never> = Omit<T, OptionalKeys> &
  Partial<Pick<T, OptionalKeys>>;

type Updatable<T> = Partial<T>;

export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: Room;
        Insert: Insertable<Room, "created_at" | "current_round" | "phase">;
        Update: Updatable<Room>;
        Relationships: [];
      };
      players: {
        Row: Player;
        Insert: Insertable<Player, "joined_at" | "score" | "is_host" | "is_spectator">;
        Update: Updatable<Player>;
        Relationships: [];
      };
      sentences: {
        Row: Sentence;
        Insert: Insertable<Sentence, "id" | "submitted" | "second_half">;
        Update: Updatable<Sentence>;
        Relationships: [];
      };
      rounds: {
        Row: Round;
        Insert: Insertable<Round, "id" | "started_at">;
        Update: Updatable<Round>;
        Relationships: [];
      };
      fakes: {
        Row: Fake;
        Insert: Insertable<Fake, "id">;
        Update: Updatable<Fake>;
        Relationships: [];
      };
      votes: {
        Row: Vote;
        Insert: Insertable<Vote, "id">;
        Update: Updatable<Vote>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_room: {
        Args: { p_nickname: string };
        Returns: string;
      };
      join_room: {
        Args: { p_code: string; p_nickname: string };
        Returns: string;
      };
      join_as_spectator: {
        Args: { p_code: string };
        Returns: string;
      };
      start_game: {
        Args: { p_room_id: string };
        Returns: void;
      };
      submit_sentence: {
        Args: {
          p_room_id: string;
          p_first_half: string;
          p_second_half: string;
        };
        Returns: void;
      };
      submit_fake: {
        Args: { p_round_id: string; p_text: string };
        Returns: void;
      };
      submit_vote: {
        Args: { p_round_id: string; p_option_id: string };
        Returns: void;
      };
      round_options: {
        Args: { p_round_id: string };
        Returns: { option_id: string; option_text: string }[];
      };
      next_round: {
        Args: { p_room_id: string };
        Returns: void;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
