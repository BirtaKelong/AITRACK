
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

export const getFinancialInsights = async (transactions: Transaction[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const transactionsSummary = transactions.map(t => ({
    type: t.type,
    amount: t.amount,
    category: t.category,
    date: t.date
  }));

  const prompt = `
    Analyze the following financial transactions and provide 3-4 concise, actionable insights.
    Include one focus on savings, one on spending patterns, and one general financial tip.
    Keep the tone professional yet encouraging.
    
    Data: ${JSON.stringify(transactionsSummary)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return response.text || "No insights available at the moment.";
  } catch (error) {
    console.error("Error fetching AI insights:", error);
    return "The financial advisor is currently offline. Please try again later.";
  }
};
