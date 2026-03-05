import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

function createSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookies().getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies().set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subcategoryId, count = 6 } = body;

    if (!subcategoryId) {
      return NextResponse.json({ 
        error: 'Subcategory ID is required' 
      }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get subcategory and category info
    const { data: subcategoryInfo, error: subcategoryError } = await supabase
      .from('categories_subcategories')
      .select(`
        subcategory,
        description,
        category_id
      `)
      .eq('id', subcategoryId)
      .single();

    if (subcategoryError || !subcategoryInfo) {
      return NextResponse.json({ error: 'Subcategory not found' }, { status: 404 });
    }

    // Get category info
    const { data: categoryInfo, error: categoryError } = await supabase
      .from('categories')
      .select('name, description')
      .eq('id', subcategoryInfo.category_id)
      .single();

    if (categoryError || !categoryInfo) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Create a comprehensive prompt for GPT
    const systemPrompt = `You are an expert at creating diverse, high-quality image generation prompts for professional photography and design. 

Your task is to generate ${count} distinct, creative prompts for ${subcategoryInfo.subcategory} images in the ${categoryInfo.name} category.

Guidelines:
- Each prompt should be unique and creative
- Focus on professional, high-quality photography and design
- Include varied styles, compositions, and perspectives
- Use descriptive language that will produce excellent AI-generated images
- Avoid repetitive or similar prompts
- Make each prompt specific enough to generate distinct images
- Focus on the visual aspects that would make for compelling images

Category: ${categoryInfo.name}
Category Description: ${categoryInfo.description}
Subcategory: ${subcategoryInfo.subcategory}
Subcategory Description: ${subcategoryInfo.description}

Generate exactly ${count} prompts, each on a new line, without numbering or bullet points.`;

    // Generate prompts using GPT 3.5
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1000,
    });

    const generatedText = completion.choices[0]?.message?.content;

    if (!generatedText) {
      return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 });
    }

    // Parse the generated prompts
    const prompts = generatedText
      .split('\n')
      .map(prompt => prompt.trim())
      .filter(prompt => prompt.length > 0)
      .slice(0, count);

    return NextResponse.json({ 
      success: true, 
      prompts,
      count: prompts.length,
      subcategory: subcategoryInfo.subcategory,
      category: categoryInfo.name
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 