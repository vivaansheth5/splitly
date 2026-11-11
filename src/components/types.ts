export interface Person {
  id: string;
  name: string;
}

/** Which people share each item: item id -> list of person ids. */
export type Assignments = Record<string, string[]>;

export type Step = "upload" | "review" | "assign" | "pay";
