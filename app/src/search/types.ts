import type { Appearance, Vehicle, Bundle53 } from '../v53/types';
export interface SearchRow {
    run_id: string;
    arm: string;
    slot: number;
    round: number;
    weather: string;
    speed_bin: string;
    speed: number;
    speed_realized: number;
    gap: number;
    cell: string;
    F_FN: number;
    F_FP: number;
    counts: Record<string, number>;
    Y: number[];
    pi_triggered: boolean;
    nemotron_calls: number;
    gemma_calls: number;
    t_sut_s: number;
    picked_by: string;
    video_sha256: string;
}
export interface SearchData {
    fields: string[];
    query: string;
    arms: {
        arm: string;
        n: number;
        FN: number;
        FP: number;
        coverage: number;
        pi: number;
        nemotron: number;
        gemma: number;
    }[];
    rows: SearchRow[];
    selected: {
        id: string;
        title: string;
        note: string;
    }[];
    weathers: string[];
    bins: string[];
    cells: string[];
    candidates: string[];
    versions: Record<string, string>;
    study_commit: string;
    smoke_n: number;
}
export interface Detail {
    id: string;
    title: string;
    note: string;
    query: string;
    source_video_sha256: string;
    proxy_sha256: string;
    video: {
        width: number;
        height: number;
        fps: number;
        nb_frames: number;
        duration_sec: number;
    };
    tracking: {
        frames: {
            d: number[][];
        }[];
        tracks: {
            alias: string;
            vehicle: string;
        }[];
    };
    vehicles: Vehicle[];
    appearance: (Appearance & {
        request_args: Record<string, unknown>;
    })[];
    agent: Bundle53["agent"];
    cases: {
        case_ref: string;
        type: string;
        question: string;
        status: string;
        result: unknown;
    }[];
    answer: {
        status: string;
        submission: {
            decision: string;
            reported_count: number;
            colors: string[];
            count_complete: boolean;
            uncertainty: string;
        };
        targets: {
            vehicle_ref: string;
            member_track_refs: string[];
            color_description: string;
            source_frame_intervals: number[][];
        }[];
    };
    ground_truth: {
        expected_count: number;
        targets: {
            id: string;
            color: string;
            boxes: number[][];
        }[];
    };
    properties: {
        fields: string[];
        Y: number[];
        counts: Record<string, number>;
        info_fields: string[];
    };
    checks: {
        runtime_final: string;
        posthoc: string;
        posthoc_issues: string[];
        traffic_truth_checked: boolean;
    };
    configuration: {
        gemma_temperature: number;
        thinking: boolean;
        tools: Record<string, string>;
    };
    wall_sec: number;
}
export interface History {
    arm: string;
    batch: number;
    before: State;
    after: State;
}
export interface State {
    weights?: Record<string, number[][]>;
    n?: number[];
    k?: Record<string, number[]>;
}
