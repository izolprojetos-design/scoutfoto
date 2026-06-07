import { useEffect } from 'react';
import { supabase } from './integrations/supabase/client';

export default function Debug() {
  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('SESSION:', session);
      if (session) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single();
        console.log('PROFILE:', profile);
        const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', session.user.id);
        console.log('ROLES:', roles);
        const { data: scouts, error } = await supabase.from('scouts').select('*').limit(5);
        console.log('SCOUTS FETCH:', scouts, error);
      }
    }
    check();
  }, []);
  return <div>Check console for debug info</div>;
}
