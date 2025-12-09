export interface VoiceRecipeItem {
  ingredient: string;
  tip: string;
}

export interface AudioStyles {
  tryIt: string[];
  dontTry: string[];
}

export interface ImprovementOpportunity {
  timestamp: string;
  issue: string;
  suggestion: string;
}

export interface VisualCoachingReport {
  toneWarmth: number; // 0-10
  score: number; // 0-100
  badge: string; // e.g., "🌼 Growing", "🌸 Friendly"
  trainingMeaning: string;
  voiceRecipe: VoiceRecipeItem[];
  audioStyles: AudioStyles;
  practiceExercise: string;
  empathyGoal: string;
  improvementOpportunities: ImprovementOpportunity[];
  rawAnalysis?: string; // original freeform text
}

export interface AnalysisResponse {
  coachingReport?: VisualCoachingReport;
  analysis?: string; // fallback for backward compatibility
  error?: string;
}
