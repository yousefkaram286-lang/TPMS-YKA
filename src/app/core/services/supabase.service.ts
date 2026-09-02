import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ncjdluhagxordnxroofg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Hk2z_in3JEYqSLuR23zWXA_y7z9nNWm';
const FUNCTIONS_BASE_URL = `${SUPABASE_URL}/functions/v1`;

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public client: SupabaseClient;

  constructor() {
    // Single shared client. Auth persistence is handled by the Supabase SDK:
    // session stored in localStorage (shared across tabs of the same browser
    // profile), auto-refreshed, and picked up from the URL for OAuth flows.
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  public functionUrl(name: string): string {
    return `${FUNCTIONS_BASE_URL}/${name}`;
  }
}
