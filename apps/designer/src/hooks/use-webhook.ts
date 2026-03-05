import { useState } from 'react';

interface LeadData {
  email: string;
  name: string;
  phone: string;
}

interface WebhookPayload {
  lead_id: string;
  timestamp: string;
  form: {
    name: string;
    email: string;
    phone: string;
    notes: string;
  };
  source: {
    widget_id: string;
    company_id: string;
    company_name: string;
    page_url: string;
  };
}

interface UseWebhookProps {
  instanceId: string;
  webhookUrl: string | null;
  companyName?: string;
}

export function useWebhook({ instanceId, webhookUrl, companyName }: UseWebhookProps) {
  const [isSending, setIsSending] = useState(false);

  const sendWebhook = async ({ leadData, prompt }: { leadData: LeadData; prompt: string }) => {
    if (!webhookUrl) {
      return;
    }

    setIsSending(true);
    
    try {
      const webhookPayload: WebhookPayload = {
        lead_id: `lead-${Date.now()}`,
        timestamp: new Date().toISOString(),
        form: {
          name: leadData.name || '',
          email: leadData.email || '',
          phone: leadData.phone || '',
          notes: `Lead captured from AI Image Generator widget. Prompt: "${prompt}"`
        },
        source: {
          widget_id: instanceId,
          company_id: instanceId,
          company_name: companyName || "AI Image Generator",
          page_url: window.location.href
        }
      };

      // Use server-side webhook proxy to avoid CORS issues
      const proxyPayload = {
        webhookUrl: webhookUrl,
        payload: webhookPayload
      };

      // Add a timeout to the fetch request to detect hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 30000);

      const webhookResponse = await fetch('/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(proxyPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      
      const webhookResult = await webhookResponse.json();

      if (!webhookResponse.ok) {
        throw new Error(`Webhook proxy failed: ${webhookResponse.status} ${webhookResponse.statusText} - ${JSON.stringify(webhookResult)}`);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsSending(false);
    }
  };

  return {
    isSending,
    sendWebhook
  };
} 