export async function GET(request: Request){
    const obj = {
        message: "Hello World"
    }

    return new Response(JSON.stringify(obj), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    })
}