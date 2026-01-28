import { supabase } from '../supabaseClient';
import { User } from '../types';
import { DbProfile } from '../db_types';

export const UserService = {
    /**
     * Get all users and their Manager/Subordinate relationships.
     * Since we are mocking relationships in types.ts but putting them in specific tables in DB,
     * we need to join them.
     */
    async fetchAllUsers(): Promise<User[]> {
        // 1. Fetch Profiles and Relationships in parallel
        const [profilesRes, relationsRes] = await Promise.all([
            supabase.from('profiles').select('*'),
            supabase.from('user_relationships').select('*')
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (relationsRes.error) throw relationsRes.error;

        const profiles = profilesRes.data || [];
        const relations = relationsRes.data || [];

        // 2. Transform to App 'User' Type
        const appUsers: User[] = profiles.map(p => ({
            id: p.id,
            name: p.full_name,
            email: p.email,
            isManager: p.is_manager,
            isAdmin: p.is_admin,
            subordinates: []
        }));

        // Fill subordinates
        relations.forEach(rel => {
            const manager = appUsers.find(u => u.id === rel.manager_id);
            if (manager) {
                if (!manager.subordinates) manager.subordinates = [];
                manager.subordinates.push(rel.subordinate_id);
            }
        });

        return appUsers;
    },

    /**
     * Seed initial users if empty (migration helper)
     */
    async seedUsers(mockUsers: User[]): Promise<void> {
        // Only run if table is empty
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (count && count > 0) return;

        console.log("Seeding Database with Mock Users...");

        for (const user of mockUsers) {
            // Insert Profile
            const { error } = await supabase.from('profiles').insert({
                id: user.id, // Keep ID consistent
                email: user.email, // Use provided email
                full_name: user.name,
                is_manager: user.isManager,
                is_admin: user.isAdmin || false
            });

            if (error) {
                console.error("Error inserting user:", user.name, error);
                throw error;
            }
        }

        // Insert Relationships
        for (const user of mockUsers) {
            if (user.subordinates && user.subordinates.length > 0) {
                const relations = user.subordinates.map(subId => ({
                    manager_id: user.id,
                    subordinate_id: subId
                }));
                const { error } = await supabase.from('user_relationships').insert(relations);

                if (error) {
                    console.error("Error inserting relationships for:", user.name, error);
                    throw error;
                }
            }
        }
        console.log("Seeding Complete.");
    },
    async createUser(user: User): Promise<void> {
        // 1. Insert Profile
        const { error: profileError } = await supabase.from('profiles').insert({
            id: user.id,
            email: user.email,
            full_name: user.name,
            is_manager: user.isManager,
            is_admin: user.isAdmin
        });
        if (profileError) throw profileError;

        // 2. Insert Relationships if any
        if (user.subordinates && user.subordinates.length > 0) {
            const relations = user.subordinates.map(subId => ({
                manager_id: user.id,
                subordinate_id: subId
            }));
            const { error: relError } = await supabase.from('user_relationships').insert(relations);
            if (relError) throw relError;
        }
    },

    async updateUser(user: User): Promise<void> {
        // 1. Update Profile
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                full_name: user.name,
                email: user.email, // Allow updating email
                is_manager: user.isManager,
                is_admin: user.isAdmin,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (profileError) throw profileError;

        // 2. Sync Relationships: Delete old ones where manager is this user
        const { error: delError } = await supabase
            .from('user_relationships')
            .delete()
            .eq('manager_id', user.id);

        if (delError) throw delError;

        // 3. Insert new ones
        if (user.subordinates && user.subordinates.length > 0) {
            const relations = user.subordinates.map(subId => ({
                manager_id: user.id,
                subordinate_id: subId
            }));
            const { error: relError } = await supabase.from('user_relationships').insert(relations);
            if (relError) throw relError;
        }
    },

    async getOrCreateProfile(userId: string, email: string, name: string): Promise<User> {
        console.log(`[UserService] getOrCreateProfile started for ${userId}`);
        try {
            console.log(`[UserService] Fetching profile from 'profiles' table...`);
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId);

            if (error) {
                console.error(`[UserService] Supabase select error:`, error);
                throw error;
            }

            console.log(`[UserService] Select result:`, profiles ? `Found ${profiles.length} profiles` : 'No profiles found');
            const profile = profiles && profiles.length > 0 ? profiles[0] : null;

            if (profile) {
                console.log(`[UserService] Profile exists for ${profile.full_name}, fetching relationships...`);
                // Profile exists, fetch subordinates and return
                const { data: relations, error: relError } = await supabase
                    .from('user_relationships')
                    .select('subordinate_id')
                    .eq('manager_id', userId);

                if (relError) {
                    console.error(`[UserService] Relationship fetch error:`, relError);
                }

                return {
                    id: profile.id,
                    name: profile.full_name,
                    email: profile.email,
                    isManager: profile.is_manager,
                    isAdmin: profile.is_admin,
                    subordinates: relations?.map(r => r.subordinate_id) || []
                };
            }

            console.log(`[UserService] No profile found, creating new one for ${name}...`);
            // Create new profile for first-time user
            const newProfile = {
                id: userId,
                email: email,
                full_name: name,
                is_manager: false, // Default to false for new social logins
                is_admin: false
            };

            const { error: insertError } = await supabase
                .from('profiles')
                .insert(newProfile);

            if (insertError) {
                console.error(`[UserService] Profile insert error:`, insertError);
                throw insertError;
            }

            console.log(`[UserService] New profile created successfully for ${name}`);
            return {
                id: newProfile.id,
                name: newProfile.full_name,
                email: newProfile.email,
                isManager: newProfile.is_manager,
                isAdmin: newProfile.is_admin,
                subordinates: []
            };
        } catch (err) {
            console.error(`[UserService] Fatal error in getOrCreateProfile:`, err);
            throw err;
        }
    },
    async deleteUser(userId: string): Promise<void> {
        // 1. Delete Weekly Plans (tasks will be deleted by ON DELETE CASCADE if set, else manual)
        await supabase.from('weekly_plans').delete().eq('user_id', userId);
        // 2. Delete Daily Plans
        await supabase.from('daily_plans').delete().eq('user_id', userId);
        // 3. Delete Relationships
        await supabase.from('user_relationships').delete().eq('manager_id', userId);
        await supabase.from('user_relationships').delete().eq('subordinate_id', userId);
        // 4. Delete Profile
        await supabase.from('profiles').delete().eq('id', userId);
    }
};
